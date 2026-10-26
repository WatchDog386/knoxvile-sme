import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Payment } from '../sales/entities/payment.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { roundKES } from '../../common/utils/money';

const DAY = 86_400_000;
const EXPIRING_DAYS = 7;

/** The span a report covers: one day, an ISO week (Monday start), a month or a year. */
export const REPORT_PERIODS = ['day', 'week', 'month', 'year'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export function toReportPeriod(value: unknown): ReportPeriod {
  return REPORT_PERIODS.includes(value as ReportPeriod) ? (value as ReportPeriod) : 'day';
}

/**
 * The business report for one period (business timezone): a day, a week
 * (Monday to Sunday), a month or a year of revenue, money collected, WiFi
 * packages, expenses, profit and cash, compared with the period before. A
 * period's report is final once it ends; the current one is live.
 */
@Injectable()
export class DailyReportService {
  constructor(
    @InjectRepository(Sale) private readonly saleRepo: Repository<Sale>,
    @InjectRepository(SaleItem) private readonly itemRepo: Repository<SaleItem>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Expense) private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
  ) {}

  /** The period containing `date` (today by default). */
  private periodRange(date: string | undefined, timezone: string, period: ReportPeriod = 'day') {
    const now = DateTime.now().setZone(timezone);
    const parsed = date ? DateTime.fromISO(date, { zone: timezone }) : now;
    const day = (parsed.isValid ? parsed : now).startOf(period);
    const start = day.toJSDate();
    const end = day.plus({ [`${period}s`]: 1 }).toJSDate();
    return { day, start, end, closed: end.getTime() <= now.toMillis() };
  }

  async report(businessId: string, date: string | undefined, timezone = 'Africa/Nairobi', period: ReportPeriod = 'day') {
    const { day, start, end, closed } = this.periodRange(date, timezone, period);
    const prev = { start: day.minus({ [`${period}s`]: 1 }).toJSDate(), end: start };

    const [sales, items, payments, expenses, prevTotals, subs, debts] = await Promise.all([
      this.saleRepo
        .createQueryBuilder('sale')
        .leftJoin('customers', 'customer', 'customer.id = sale.customerId')
        .addSelect('customer.name', 'customer_name')
        .where('sale.businessId = :businessId', { businessId })
        .andWhere("sale.payment_status != 'CANCELLED'")
        .andWhere("sale.sale_type != 'ADVANCE'")
        .andWhere('sale.created_at >= :start AND sale.created_at < :end', { start, end })
        .orderBy('sale.created_at', 'DESC')
        .getRawAndEntities(),
      this.itemRepo
        .createQueryBuilder('item')
        .innerJoin('sales', 'sale', 'sale.id = item.saleId')
        .leftJoin('products', 'product', 'product.id = item.productId')
        .leftJoin('services', 'service', 'service.id = item.serviceId')
        .select('COALESCE(product.name, service.name, item.item_name)', 'name')
        .addSelect('product.billing_days', 'billing_days')
        .addSelect('item.package_event', 'event')
        .addSelect('item.quantity', 'quantity')
        .addSelect('item.total', 'total')
        .addSelect('COALESCE(item.cost_price, 0) * item.quantity', 'cost')
        .where('sale.businessId = :businessId', { businessId })
        .andWhere("sale.payment_status != 'CANCELLED'")
        .andWhere("sale.sale_type != 'ADVANCE'")
        .andWhere('sale.created_at >= :start AND sale.created_at < :end', { start, end })
        .getRawMany<{ name: string; billing_days: number | null; event: string | null; quantity: string; total: string; cost: string }>(),
      this.paymentRepo
        .createQueryBuilder('p')
        .select('p.method', 'method')
        .addSelect('COALESCE(SUM(p.amount), 0)', 'total')
        .addSelect('COUNT(*)', 'count')
        .where('p.businessId = :businessId', { businessId })
        .andWhere("p.status = 'SUCCESS'")
        .andWhere('p.transaction_date >= :start AND p.transaction_date < :end', { start, end })
        .groupBy('p.method')
        .getRawMany<{ method: string; total: string; count: string }>(),
      this.expenseRepo
        .createQueryBuilder('expense')
        .leftJoin('categories', 'category', 'category.id = expense.categoryId')
        .addSelect("COALESCE(category.name, 'Uncategorised')", 'category_name')
        .where('expense.businessId = :businessId', { businessId })
        .andWhere("expense.status IN ('APPROVED', 'PENDING')")
        .andWhere('expense.expense_date >= :start AND expense.expense_date < :end', { start, end })
        .orderBy('expense.amount', 'DESC')
        .getRawAndEntities(),
      this.totals(businessId, prev.start, prev.end),
      this.subRepo.find({ where: { businessId }, select: ['id', 'expires_at', 'started_at', 'created_at'] }),
      this.customerRepo
        .createQueryBuilder('c')
        .select('COALESCE(SUM(c.outstanding_balance), 0)', 'total')
        .addSelect('COUNT(*)', 'count')
        .where('c.businessId = :businessId', { businessId })
        .andWhere('c.outstanding_balance > 0')
        .getRawOne<{ total: string; count: string }>(),
    ]);

    // Revenue
    const revenueSales = sales.entities.filter((sale) => sale.sale_type !== 'ADVANCE');
    const revenue = revenueSales.reduce((sum, s) => sum + s.total, 0);
    const salesCount = revenueSales.length;
    const byMethodSales = new Map<string, { total: number; count: number }>();
    for (const s of revenueSales) {
      const m = byMethodSales.get(s.payment_method) ?? { total: 0, count: 0 };
      m.total += s.total;
      m.count += 1;
      byMethodSales.set(s.payment_method, m);
    }
    const collected = payments.reduce((sum, p) => sum + Number(p.total), 0);
    const unpaidSales = sales.entities.filter((s) => s.payment_status !== 'PAID');

    // Packages vs other items
    const packages = new Map<string, { quantity: number; revenue: number }>();
    const products = new Map<string, { quantity: number; revenue: number; cost: number }>();
    let newSubs = 0;
    let renewals = 0;
    let cogs = 0;
    for (const row of items) {
      const qty = Number(row.quantity);
      const total = Number(row.total);
      cogs += Number(row.cost);
      if (row.billing_days || row.event) {
        const p = packages.get(row.name) ?? { quantity: 0, revenue: 0 };
        p.quantity += qty;
        p.revenue += total;
        packages.set(row.name, p);
        if (row.event === 'NEW') newSubs += qty;
        if (row.event === 'RENEWAL') renewals += qty;
      } else {
        const p = products.get(row.name) ?? { quantity: 0, revenue: 0, cost: 0 };
        p.quantity += qty;
        p.revenue += total;
        p.cost += Number(row.cost);
        products.set(row.name, p);
      }
    }

    // Expenses: approved count towards totals; pending are shown apart
    const approved = expenses.entities.filter((e) => e.status === 'APPROVED');
    const pending = expenses.entities.filter((e) => e.status === 'PENDING');
    const expenseTotal = approved.reduce((sum, e) => sum + e.amount, 0);
    const byCategory = new Map<string, number>();
    expenses.entities.forEach((e, i) => {
      if (e.status !== 'APPROVED') return;
      const name = (expenses.raw[i] as { category_name?: string }).category_name ?? 'Uncategorised';
      byCategory.set(name, (byCategory.get(name) ?? 0) + e.amount);
    });

    // Subscribers right now (as at the end of the day for past days)
    const at = closed ? end.getTime() : Date.now();
    let active = 0;
    let expiring = 0;
    let expired = 0;
    let expiredThisDay = 0;
    for (const s of subs) {
      if (s.created_at.getTime() >= end.getTime()) continue;
      const t = s.expires_at.getTime();
      if (t <= at) expired++;
      else if (t - at <= EXPIRING_DAYS * DAY) expiring++;
      else active++;
      if (t >= start.getTime() && t < end.getTime()) expiredThisDay++;
    }

    const grossProfit = roundKES(revenue - cogs);
    const netProfit = roundKES(grossProfit - expenseTotal);

    return {
      period,
      date: day.toISODate(),
      from: start,
      to: end,
      closed,
      generatedAt: new Date(),
      revenue: {
        total: revenue,
        salesCount,
        averageSale: salesCount ? Math.round(revenue / salesCount) : 0,
        collected,
        unpaid: unpaidSales.length,
        byMethod: [...byMethodSales.entries()]
          .map(([method, v]) => ({ method, ...v }))
          .sort((a, b) => b.total - a.total),
        collectedByMethod: payments
          .map((p) => ({ method: p.method, total: Number(p.total), count: Number(p.count) }))
          .sort((a, b) => b.total - a.total),
      },
      packages: {
        sold: [...packages.values()].reduce((sum, p) => sum + p.quantity, 0),
        revenue: [...packages.values()].reduce((sum, p) => sum + p.revenue, 0),
        newSubscribers: newSubs,
        renewals,
        lines: [...packages.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue),
      },
      products: [...products.entries()]
        .map(([name, v]) => ({ name, quantity: v.quantity, revenue: v.revenue, profit: v.revenue - v.cost }))
        .sort((a, b) => b.revenue - a.revenue),
      expenses: {
        total: expenseTotal,
        count: approved.length,
        pendingCount: pending.length,
        pendingTotal: pending.reduce((sum, e) => sum + e.amount, 0),
        byCategory: [...byCategory.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
        items: expenses.entities.map((e, i) => ({
          id: e.id,
          date: e.expense_date,
          description: e.description,
          category: (expenses.raw[i] as { category_name?: string }).category_name ?? 'Uncategorised',
          amount: e.amount,
          status: e.status,
          method: e.payment_method,
        })),
      },
      profit: {
        cogs,
        gross: grossProfit,
        net: netProfit,
        margin: revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0,
      },
      cash: { moneyIn: collected, moneyOut: expenseTotal, net: collected - expenseTotal },
      subscribers: { active, expiring, expired, expiredThisDay },
      debts: { outstanding: Number(debts?.total ?? 0), debtors: Number(debts?.count ?? 0) },
      previous: prevTotals,
      sales: sales.entities.map((s, i) => ({
        id: s.id,
        number: s.number,
        at: s.created_at,
        customer: (sales.raw[i] as { customer_name?: string }).customer_name ?? 'Walk-in',
        type: s.sale_type,
        total: s.total,
        method: s.payment_method,
        status: s.payment_status,
      })),
    };
  }

  /** Revenue, expenses and net profit for each of the last `count` periods (oldest first). */
  async history(businessId: string, count = 7, until?: string, timezone = 'Africa/Nairobi', period: ReportPeriod = 'day') {
    const { day } = this.periodRange(until, timezone, period);
    const unit = `${period}s`;
    const out: Array<{ date: string; revenue: number; expenses: number; net: number; salesCount: number }> = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = day.minus({ [unit]: i });
      const t = await this.totals(businessId, d.toJSDate(), d.plus({ [unit]: 1 }).toJSDate());
      out.push({ date: d.toISODate() ?? '', revenue: t.revenue, expenses: t.expenses, net: t.net, salesCount: t.salesCount });
    }
    return out;
  }

  private async totals(businessId: string, start: Date, end: Date) {
    const [sale, cost, exp] = await Promise.all([
      this.saleRepo
        .createQueryBuilder('sale')
        .select('COALESCE(SUM(sale.total), 0)', 'sum')
        .addSelect('COUNT(*)', 'count')
        .where('sale.businessId = :businessId', { businessId })
        .andWhere("sale.payment_status != 'CANCELLED'")
        .andWhere("sale.sale_type != 'ADVANCE'")
        .andWhere('sale.created_at >= :start AND sale.created_at < :end', { start, end })
        .getRawOne<{ sum: string; count: string }>(),
      this.itemRepo
        .createQueryBuilder('item')
        .innerJoin('sales', 'sale', 'sale.id = item.saleId')
        .select('COALESCE(SUM(COALESCE(item.cost_price, 0) * item.quantity), 0)', 'sum')
        .where('sale.businessId = :businessId', { businessId })
        .andWhere("sale.payment_status != 'CANCELLED'")
        .andWhere("sale.sale_type != 'ADVANCE'")
        .andWhere('sale.created_at >= :start AND sale.created_at < :end', { start, end })
        .getRawOne<{ sum: string }>(),
      this.expenseRepo
        .createQueryBuilder('expense')
        .select('COALESCE(SUM(expense.amount), 0)', 'sum')
        .where('expense.businessId = :businessId', { businessId })
        .andWhere("expense.status = 'APPROVED'")
        .andWhere('expense.expense_date >= :start AND expense.expense_date < :end', { start, end })
        .getRawOne<{ sum: string }>(),
    ]);
    const revenue = Number(sale?.sum ?? 0);
    const expenses = Number(exp?.sum ?? 0);
    return {
      revenue,
      salesCount: Number(sale?.count ?? 0),
      expenses,
      net: roundKES(revenue - Number(cost?.sum ?? 0) - expenses),
    };
  }
}
