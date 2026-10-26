import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Customer } from '../customers/entities/customer.entity';
import { roundKES } from '../../common/utils/money';
import { todayRangeUtc } from '../../common/utils/dates';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly itemRepo: Repository<SaleItem>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  private resolveRange(from?: string, to?: string, timezone = 'Africa/Nairobi') {
    if (from && to) {
      return { start: new Date(from), end: new Date(to) };
    }
    if (from) {
      const start = new Date(from);
      return { start, end: new Date(start.getTime() + 86400000) };
    }
    return todayRangeUtc(timezone);
  }

  async profitLoss(
    businessId: string,
    from?: string,
    to?: string,
    timezone = 'Africa/Nairobi',
  ) {
    const { start, end } = this.resolveRange(from, to, timezone);
    const [revenue, cogs, expenses, salesCount, revenueByMethod] =
      await Promise.all([
        this.sumSales(businessId, start, end),
        this.sumCogs(businessId, start, end),
        this.sumExpenses(businessId, start, end),
        this.countSales(businessId, start, end),
        this.revenueByMethod(businessId, start, end),
      ]);

    const grossProfit = roundKES(revenue - cogs);
    const netProfit = roundKES(grossProfit - expenses);

    return {
      from: start,
      to: end,
      revenue,
      cogs,
      grossProfit,
      operatingExpenses: expenses,
      netProfit,
      grossMargin: revenue > 0 ? Math.round((grossProfit / revenue) * 100) : 0,
      netMargin: revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0,
      salesCount,
      averageSaleValue: salesCount > 0 ? Math.round(revenue / salesCount) : 0,
      revenueByMethod,
    };
  }

  async dailySummary(
    businessId: string,
    from?: string,
    to?: string,
    timezone = 'Africa/Nairobi',
  ) {
    const { start, end } = this.resolveRange(from, to, timezone);

    const [sales, cogs, expenses] = await Promise.all([
      this.saleRepo
        .createQueryBuilder('sale')
        .select('DATE(sale.created_at)', 'date')
        .addSelect('COALESCE(SUM(sale.total), 0)', 'revenue')
        .where('sale.businessId = :businessId', { businessId })
        .andWhere("sale.payment_status != 'CANCELLED'")
        .andWhere("sale.sale_type != 'ADVANCE'")
        .andWhere('sale.created_at >= :start', { start })
        .andWhere('sale.created_at < :end', { end })
        .groupBy('DATE(sale.created_at)')
        .getRawMany<{ date: string; revenue: string }>(),
      this.itemRepo
        .createQueryBuilder('item')
        .innerJoin('sales', 'sale', 'sale.id = item.saleId')
        .select('DATE(sale.created_at)', 'date')
        .addSelect('COALESCE(SUM(item.cost_price * item.quantity), 0)', 'cogs')
        .where('sale.businessId = :businessId', { businessId })
        .andWhere("sale.payment_status != 'CANCELLED'")
        .andWhere('sale.created_at >= :start', { start })
        .andWhere('sale.created_at < :end', { end })
        .groupBy('DATE(sale.created_at)')
        .getRawMany<{ date: string; cogs: string }>(),
      this.expenseRepo
        .createQueryBuilder('expense')
        .select('DATE(expense.expense_date)', 'date')
        .addSelect('COALESCE(SUM(expense.amount), 0)', 'expenses')
        .where('expense.businessId = :businessId', { businessId })
        .andWhere("expense.status = 'APPROVED'")
        .andWhere('expense.expense_date >= :start', { start })
        .andWhere('expense.expense_date < :end', { end })
        .groupBy('DATE(expense.expense_date)')
        .getRawMany<{ date: string; expenses: string }>(),
    ]);

    const byDate = new Map<string, { revenue: number; cogs: number; expenses: number }>();
    for (const row of sales) {
      const entry = byDate.get(row.date) ?? { revenue: 0, cogs: 0, expenses: 0 };
      entry.revenue = Number(row.revenue);
      byDate.set(row.date, entry);
    }
    for (const row of cogs) {
      const entry = byDate.get(row.date) ?? { revenue: 0, cogs: 0, expenses: 0 };
      entry.cogs = Number(row.cogs);
      byDate.set(row.date, entry);
    }
    for (const row of expenses) {
      const entry = byDate.get(row.date) ?? { revenue: 0, cogs: 0, expenses: 0 };
      entry.expenses = Number(row.expenses);
      byDate.set(row.date, entry);
    }

    return Array.from(byDate.entries())
      .map(([date, v]) => ({
        date,
        ...v,
        grossProfit: roundKES(v.revenue - v.cogs),
        netProfit: roundKES(v.revenue - v.cogs - v.expenses),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async productPerformance(businessId: string, from?: string, to?: string, limit = 10) {
    const { start, end } = this.resolveRange(from, to);
    const rows = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('sales', 'sale', 'sale.id = item.saleId')
      .leftJoin('products', 'product', 'product.id = item.productId')
      .leftJoin('services', 'service', 'service.id = item.serviceId')
      .select('COALESCE(product.name, service.name, item.item_name)', 'name')
      .addSelect('SUM(item.quantity)', 'quantity')
      .addSelect('SUM(item.total)', 'revenue')
      .addSelect('COALESCE(SUM(item.cost_price * item.quantity), 0)', 'cogs')
      .where('sale.businessId = :businessId', { businessId })
      .andWhere("sale.payment_status != 'CANCELLED'")
      .andWhere("sale.sale_type != 'ADVANCE'")
      .andWhere('sale.created_at >= :start', { start })
      .andWhere('sale.created_at < :end', { end })
      .groupBy('COALESCE(product.name, service.name, item.item_name)')
      .orderBy('SUM(item.total)', 'DESC')
      .take(limit)
      .getRawMany<{ name: string; quantity: string; revenue: string; cogs: string }>();

    return rows.map((row) => ({
      name: row.name,
      quantity: Number(row.quantity),
      revenue: Number(row.revenue),
      cogs: Number(row.cogs),
      profit: roundKES(Number(row.revenue) - Number(row.cogs)),
    }));
  }

  async customerPerformance(businessId: string, limit = 10) {
    return this.customerRepo.find({
      where: { businessId },
      order: { total_spent: 'DESC' },
      take: limit,
    });
  }

  async expenseSummary(businessId: string, from?: string, to?: string) {
    const { start, end } = this.resolveRange(from, to);
    const rows = await this.expenseRepo
      .createQueryBuilder('expense')
      .leftJoin('categories', 'category', 'category.id = expense.categoryId')
      .select('COALESCE(category.name, \'Uncategorized\')', 'category')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'amount')
      .where('expense.businessId = :businessId', { businessId })
      .andWhere("expense.status = 'APPROVED'")
      .andWhere('expense.expense_date >= :start', { start })
      .andWhere('expense.expense_date < :end', { end })
      .groupBy('COALESCE(category.name, \'Uncategorized\')')
      .orderBy('SUM(expense.amount)', 'DESC')
      .getRawMany<{ category: string; amount: string }>();
    return rows.map((row) => ({ category: row.category, amount: Number(row.amount) }));
  }

  /** Individual expenses in range (APPROVED unless a status is given). */
  async expenseDetails(
    businessId: string,
    from?: string,
    to?: string,
    status: string = 'APPROVED',
  ) {
    const { start, end } = this.resolveRange(from, to);
    const rows = await this.expenseRepo
      .createQueryBuilder('expense')
      .leftJoin('categories', 'category', 'category.id = expense.categoryId')
      .addSelect('category.name', 'category_name')
      .where('expense.businessId = :businessId', { businessId })
      .andWhere('expense.status = :status', { status })
      .andWhere('expense.expense_date >= :start', { start })
      .andWhere('expense.expense_date < :end', { end })
      .orderBy('expense.expense_date', 'ASC')
      .getRawAndEntities();
    return rows.entities.map((expense, idx) => ({
      date: expense.expense_date,
      description: expense.description,
      category:
        (rows.raw[idx] as { category_name?: string }).category_name ??
        'Uncategorized',
      paymentMethod: expense.payment_method,
      status: expense.status,
      amount: expense.amount,
    }));
  }

  async salesCsv(businessId: string, from?: string, to?: string) {
    const { start, end } = this.resolveRange(from, to);
    const rows = await this.saleRepo
      .createQueryBuilder('sale')
      .leftJoin('customers', 'customer', 'customer.id = sale.customerId')
      .addSelect('customer.name', 'customer_name')
      .where('sale.businessId = :businessId', { businessId })
      .andWhere('sale.created_at >= :start', { start })
      .andWhere('sale.created_at < :end', { end })
      .orderBy('sale.created_at', 'ASC')
      .getRawAndEntities();

    const header = 'Date,Customer,Payment Method,Status,Subtotal,Discount,Tax,Total\n';
    const lines = rows.entities.map((sale, idx) => {
      const raw = rows.raw[idx] as { customer_name?: string };
      const date = sale.created_at.toISOString().slice(0, 10);
      const customer = (raw.customer_name ?? 'Walk-in').replace(/,/g, ' ');
      return [
        date,
        customer,
        sale.payment_method,
        sale.payment_status,
        sale.subtotal,
        sale.discount,
        sale.tax,
        sale.total,
      ].join(',');
    });
    return header + lines.join('\n');
  }

  private async sumSales(businessId: string, start: Date, end: Date): Promise<number> {
    const row = await this.saleRepo
      .createQueryBuilder('sale')
      .select('COALESCE(SUM(sale.total), 0)', 'sum')
      .where('sale.businessId = :businessId', { businessId })
      .andWhere("sale.payment_status != 'CANCELLED'")
      .andWhere("sale.sale_type != 'ADVANCE'")
      .andWhere('sale.created_at >= :start', { start })
      .andWhere('sale.created_at < :end', { end })
      .getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0);
  }

  private async sumCogs(businessId: string, start: Date, end: Date): Promise<number> {
    const row = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('sales', 'sale', 'sale.id = item.saleId')
      .select('COALESCE(SUM(item.cost_price * item.quantity), 0)', 'sum')
      .where('sale.businessId = :businessId', { businessId })
      .andWhere("sale.payment_status != 'CANCELLED'")
      .andWhere("sale.sale_type != 'ADVANCE'")
      .andWhere('sale.created_at >= :start', { start })
      .andWhere('sale.created_at < :end', { end })
      .getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0);
  }

  private async sumExpenses(businessId: string, start: Date, end: Date): Promise<number> {
    const row = await this.expenseRepo
      .createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'sum')
      .where('expense.businessId = :businessId', { businessId })
      .andWhere("expense.status = 'APPROVED'")
      .andWhere('expense.expense_date >= :start', { start })
      .andWhere('expense.expense_date < :end', { end })
      .getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0);
  }

  private async countSales(businessId: string, start: Date, end: Date): Promise<number> {
    const row = await this.saleRepo
      .createQueryBuilder('sale')
      .select('COUNT(*)', 'count')
      .where('sale.businessId = :businessId', { businessId })
      .andWhere("sale.payment_status != 'CANCELLED'")
      .andWhere("sale.sale_type != 'ADVANCE'")
      .andWhere('sale.created_at >= :start', { start })
      .andWhere('sale.created_at < :end', { end })
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  private async revenueByMethod(businessId: string, start: Date, end: Date) {
    const rows = await this.saleRepo
      .createQueryBuilder('sale')
      .select('sale.payment_method', 'method')
      .addSelect('COALESCE(SUM(sale.total), 0)', 'total')
      .where('sale.businessId = :businessId', { businessId })
      .andWhere("sale.payment_status != 'CANCELLED'")
      .andWhere("sale.sale_type != 'ADVANCE'")
      .andWhere('sale.created_at >= :start', { start })
      .andWhere('sale.created_at < :end', { end })
      .groupBy('sale.payment_method')
      .getRawMany<{ method: string; total: string }>();
    return rows.map((row) => ({ method: row.method, total: Number(row.total) }));
  }
}
