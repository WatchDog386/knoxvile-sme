import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../products/entities/product.entity';
import { Payment } from '../sales/entities/payment.entity';
import { SalesService } from '../sales/sales.service';
import { ExpensesService } from '../expenses/expenses.service';
import { BudgetsService } from '../budgets/budgets.service';
import { RecurringExpensesService } from '../recurring-expenses/recurring-expenses.service';
import { todayRangeUtc, lastNDaysRangeUtc } from '../../common/utils/dates';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CallsService } from '../calls/calls.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly itemRepo: Repository<SaleItem>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly salesService: SalesService,
    private readonly expensesService: ExpensesService,
    private readonly budgetsService: BudgetsService,
    private readonly recurringExpensesService: RecurringExpensesService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly callsService: CallsService,
  ) {}

  async getDashboard(businessId: string, timezone: string) {
    const today = todayRangeUtc(timezone);
    const week = lastNDaysRangeUtc(7, timezone);
    const month = lastNDaysRangeUtc(30, timezone);

    // Catch up on recurring expenses before totals are computed.
    await this.recurringExpensesService.generateDue(businessId, timezone);

    const [todaySales, todayCogs, todayExpenses, outstandingDebts, lowStock, recentCustomers, salesSeries] =
      await Promise.all([
        this.sumSales(businessId, today.start, today.end),
        this.sumCogs(businessId, today.start, today.end),
        this.expensesService.totalInRange(businessId, today.start, today.end),
        this.sumOutstandingDebts(businessId),
        this.lowStockCount(businessId),
        this.recentDebtors(businessId, 5),
        this.dailySalesSeries(businessId, week.start, week.end),
      ]);

    const grossProfit = todaySales - todayCogs;
    const netProfit = grossProfit - todayExpenses;

    const [
      recentTransactions,
      monthRevenue,
      topProducts,
      salesCount,
      budgetAlerts,
      pendingApprovals,
      recentMoney,
    ] = await Promise.all([
      this.recentTransactions(businessId, 10),
      this.sumPayments(businessId, month.start, month.end),
      this.topProducts(businessId, month.start, month.end, 5),
      this.countSales(businessId, today.start, today.end),
      this.budgetsService.alerts(businessId, timezone),
      this.expensesService.countPending(businessId),
      this.recentMoney(businessId),
    ]);

    return {
      today: {
        sales: todaySales,
        cashReceived: await this.sumPayments(businessId, today.start, today.end),
        expenses: todayExpenses,
        grossProfit,
        netProfit,
        salesCount,
        paymentCount: await this.countPayments(businessId, today.start, today.end),
      },
      weekRevenue: await this.sumPayments(businessId, week.start, week.end),
      monthRevenue,
      outstandingDebts,
      lowStock,
      appointmentsToday: 0,
      recentCustomers,
      recentTransactions,
      recentMoney,
      topProducts,
      salesSeries,
      budgetAlerts,
      pendingApprovals,
      // Internet provider figures
      packagesToday: await this.packagesSold(businessId, today.start, today.end),
      subscribers: await this.subscriptionsService.stats(businessId),
      callsDue: await this.callsService.dueCount(businessId),
    };
  }

  /** WiFi packages sold in a period, split into new subscriptions and renewals. */
  private async packagesSold(businessId: string, from: Date, to: Date) {
    const rows = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin(Sale, 'sale', 'sale.id = item.saleId')
      .select('item.package_event', 'event')
      .addSelect('COALESCE(SUM(item.quantity), 0)', 'qty')
      .addSelect('COALESCE(SUM(item.total), 0)', 'revenue')
      .where('sale.businessId = :businessId', { businessId })
      .andWhere("sale.payment_status != 'CANCELLED'")
      .andWhere('sale.updated_at >= :from AND sale.updated_at < :to', { from, to })
      .andWhere('item.package_event IS NOT NULL')
      .groupBy('item.package_event')
      .getRawMany<{ event: string; qty: string; revenue: string }>();
    const pick = (e: string) => rows.find((r) => r.event === e);
    const newCount = Number(pick('NEW')?.qty ?? 0);
    const renewals = Number(pick('RENEWAL')?.qty ?? 0);
    return {
      count: newCount + renewals,
      new: newCount,
      renewals,
      revenue: await this.packageCashReceived(businessId, from, to),
    };
  }

  private async sumSales(businessId: string, from: Date, to: Date): Promise<number> {
    const row = await this.saleRepo
      .createQueryBuilder('sale')
      .select('COALESCE(SUM(sale.total), 0)', 'sum')
      .where('sale.businessId = :businessId', { businessId })
      .andWhere("sale.payment_status != 'CANCELLED'")
      .andWhere("sale.sale_type != 'ADVANCE'")
      .andWhere('EXISTS (SELECT 1 FROM sale_items recognized_item WHERE recognized_item.\"saleId\" = sale.id)')
      .andWhere('sale.created_at >= :from', { from })
      .andWhere('sale.created_at < :to', { to })
      .getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0);
  }

  /** Cash revenue is the money actually received on its transaction date. */
  private async sumPayments(businessId: string, from: Date, to: Date): Promise<number> {
    const row = await this.paymentRepo.createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount), 0)', 'sum')
      .where('payment.businessId = :businessId', { businessId })
      .andWhere("payment.status = 'SUCCESS'")
      .andWhere('payment.transaction_date >= :from AND payment.transaction_date < :to', { from, to })
      .getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0);
  }

  private async countPayments(businessId: string, from: Date, to: Date): Promise<number> {
    return this.paymentRepo.createQueryBuilder('payment')
      .where('payment.businessId = :businessId', { businessId })
      .andWhere("payment.status = 'SUCCESS'")
      .andWhere('payment.transaction_date >= :from AND payment.transaction_date < :to', { from, to })
      .getCount();
  }

  private async packageCashReceived(businessId: string, from: Date, to: Date): Promise<number> {
    const row = await this.paymentRepo.createQueryBuilder('payment')
      .innerJoin(Sale, 'sale', 'sale.id = payment.saleId')
      .select('COALESCE(SUM(payment.amount), 0)', 'sum')
      .where('payment.businessId = :businessId', { businessId })
      .andWhere("payment.status = 'SUCCESS'")
      .andWhere('payment.transaction_date >= :from AND payment.transaction_date < :to', { from, to })
      .andWhere("(sale.sale_type = 'PACKAGE' OR EXISTS (SELECT 1 FROM sale_items package_item INNER JOIN products package_product ON package_product.id = package_item.\"productId\" WHERE package_item.\"saleId\" = sale.id AND package_product.billing_days IS NOT NULL))")
      .getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0);
  }

  private async sumCogs(businessId: string, from: Date, to: Date): Promise<number> {
    const row = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('sales', 'sale', 'sale.id = item.saleId')
      .select(
        'COALESCE(SUM(item.cost_price * item.quantity), 0)',
        'sum',
      )
      .where('sale.businessId = :businessId', { businessId })
      .andWhere("sale.payment_status != 'CANCELLED'")
      .andWhere('sale.created_at >= :from', { from })
      .andWhere('sale.created_at < :to', { to })
      .getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0);
  }

  private async sumOutstandingDebts(businessId: string): Promise<number> {
    const row = await this.customerRepo
      .createQueryBuilder('customer')
      .select('COALESCE(SUM(customer.outstanding_balance), 0)', 'sum')
      .where('customer.businessId = :businessId', { businessId })
      .getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0);
  }

  private async lowStockCount(businessId: string): Promise<number> {
    const row = await this.productRepo
      .createQueryBuilder('product')
      .select('COUNT(*)', 'count')
      .where('product.businessId = :businessId', { businessId })
      .andWhere('product.track_inventory = :track', { track: true })
      .andWhere('product.active = :active', { active: true })
      .andWhere('product.stock_quantity <= product.low_stock_threshold')
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  private async recentDebtors(businessId: string, limit: number) {
    return this.customerRepo.find({
      where: { businessId },
      order: { outstanding_balance: 'DESC' },
      take: limit,
    });
  }

  private async dailySalesSeries(businessId: string, from: Date, to: Date) {
    const qb = this.paymentRepo
      .createQueryBuilder('payment')
      .select('DATE(payment.transaction_date)', 'date')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'total')
      .where('payment.businessId = :businessId', { businessId })
      .andWhere("payment.status = 'SUCCESS'")
      .andWhere('payment.transaction_date >= :from', { from })
      .andWhere('payment.transaction_date < :to', { to })
      .groupBy('DATE(payment.transaction_date)')
      .orderBy('DATE(payment.transaction_date)', 'ASC');
    return qb.getRawMany<{ date: string; total: string }>();
  }

  /**
   * Payments received and unpaid sales recorded in the last 24 hours, for
   * notifications. By when they were recorded (created_at), not the sale
   * date, so a paybill payment or a back-dated sale still counts as new.
   */
  private async recentMoney(businessId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [payments, unpaidSales] = await Promise.all([
      this.paymentRepo
        .createQueryBuilder('payment')
        .leftJoin(Sale, 'sale', 'sale.id = payment.saleId')
        .leftJoin(Customer, 'customer', 'customer.id = COALESCE(payment.customerId, sale.customerId)')
        .select('payment.id', 'id')
        .addSelect('payment.amount', 'amount')
        .addSelect('payment.method', 'method')
        .addSelect('payment.created_at', 'created_at')
        .addSelect('sale.id', 'sale_id')
        .addSelect('sale.sale_type', 'sale_type')
        .addSelect('customer.name', 'customer_name')
        .where('payment.businessId = :businessId', { businessId })
        .andWhere("payment.status = 'SUCCESS'")
        .andWhere('payment.created_at >= :since', { since })
        .orderBy('payment.created_at', 'DESC')
        .limit(30)
        .getRawMany<{ id: string; amount: number; method: string; created_at: Date; sale_id: string | null; sale_type: string | null; customer_name: string | null }>(),
      this.saleRepo
        .createQueryBuilder('sale')
        .leftJoin(Customer, 'customer', 'customer.id = sale.customerId')
        .select('sale.id', 'id')
        .addSelect('sale.total', 'total')
        .addSelect('sale.number', 'number')
        .addSelect('sale.payment_method', 'method')
        .addSelect('sale.created_at', 'created_at')
        .addSelect('customer.name', 'customer_name')
        .where('sale.businessId = :businessId', { businessId })
        .andWhere("sale.payment_status = 'UNPAID'")
        .andWhere('sale.created_at >= :since', { since })
        .orderBy('sale.created_at', 'DESC')
        .limit(30)
        .getRawMany<{ id: string; total: number; number: number | null; method: string; created_at: Date; customer_name: string | null }>(),
    ]);
    return [
      ...payments.map((p) => ({
        type: 'PAYMENT' as const,
        id: p.id,
        saleId: p.sale_id,
        amount: Number(p.amount),
        paymentMethod: p.method,
        status: 'SUCCESS',
        description: p.sale_type === 'ADVANCE' ? 'Credit on account' : 'Payment received',
        customerName: p.customer_name,
        createdAt: p.created_at,
      })),
      ...unpaidSales.map((s) => ({
        type: 'SALE' as const,
        id: s.id,
        saleId: s.id,
        amount: Number(s.total),
        paymentMethod: s.method,
        status: 'UNPAID',
        description: `Unpaid sale #${s.number ?? s.id.slice(0, 8).toUpperCase()}`,
        customerName: s.customer_name,
        createdAt: s.created_at,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private async recentTransactions(businessId: string, limit: number) {
    const [payments, unpaidSales, expenses] = await Promise.all([
      this.paymentRepo
        .createQueryBuilder('payment')
        .leftJoin(Sale, 'sale', 'sale.id = payment.saleId')
        .leftJoin(Customer, 'customer', 'customer.id = COALESCE(payment.customerId, sale.customerId)')
        .addSelect('customer.name', 'customer_name')
        .addSelect('sale.id', 'sale_id')
        .addSelect('sale.sale_type', 'sale_type')
        .where('payment.businessId = :businessId', { businessId })
        .andWhere("payment.status = 'SUCCESS'")
        .orderBy('payment.transaction_date', 'DESC')
        .take(limit)
        .getRawAndEntities(),
      this.saleRepo
        .createQueryBuilder('sale')
        .leftJoin(Customer, 'customer', 'customer.id = sale.customerId')
        .addSelect('customer.name', 'customer_name')
        .where('sale.businessId = :businessId', { businessId })
        .andWhere("sale.payment_status = 'UNPAID'")
        .orderBy('sale.created_at', 'DESC')
        .take(limit)
        .getRawAndEntities(),
      this.expenseRepo
        .createQueryBuilder('expense')
        .where('expense.businessId = :businessId', { businessId })
        .andWhere("expense.status = 'APPROVED'")
        .orderBy('expense.created_at', 'DESC')
        .take(limit)
        .getMany(),
    ]);

    const transactions = [
      ...payments.entities.map((payment, idx) => ({
        type: 'PAYMENT' as const,
        id: payment.id,
        saleId: (payments.raw[idx] as { sale_id?: string | null }).sale_id ?? null,
        amount: payment.amount,
        paymentMethod: payment.method,
        status: payment.status,
        description: `Payment received${(payments.raw[idx] as { sale_type?: string }).sale_type === 'ADVANCE' ? ' · advance' : ''}`,
        customerName: (payments.raw[idx] as { customer_name?: string }).customer_name ?? 'Walk-in',
        createdAt: payment.transaction_date,
      })),
      ...unpaidSales.entities.map((sale, idx) => ({
        type: 'SALE' as const,
        id: sale.id,
        saleId: sale.id,
        amount: sale.total,
        paymentMethod: sale.payment_method,
        status: sale.payment_status,
        description: `Unpaid sale #${sale.number ?? sale.id.slice(0, 8).toUpperCase()}`,
        customerName: (unpaidSales.raw[idx] as { customer_name?: string }).customer_name ?? 'Walk-in',
        createdAt: sale.created_at,
      })),
      ...expenses.map((expense) => ({
        type: 'EXPENSE' as const,
        id: expense.id,
        amount: expense.amount,
        paymentMethod: expense.payment_method,
        status: 'DONE',
        description: expense.description,
        customerName: null,
        createdAt: expense.created_at,
      })),
    ];

    return transactions
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, limit);
  }

  private async topProducts(businessId: string, from: Date, to: Date, limit: number) {
    return this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('sales', 'sale', 'sale.id = item.saleId')
      .leftJoin('products', 'product', 'product.id = item.productId')
      .leftJoin('services', 'service', 'service.id = item.serviceId')
      .select('COALESCE(product.name, service.name, item.item_name)', 'name')
      .addSelect('SUM(item.quantity)', 'quantity')
      .addSelect('SUM(item.total)', 'revenue')
      .where('sale.businessId = :businessId', { businessId })
      .andWhere("sale.payment_status != 'CANCELLED'")
      .andWhere('sale.created_at >= :from', { from })
      .andWhere('sale.created_at < :to', { to })
      .groupBy('COALESCE(product.name, service.name, item.item_name)')
      .orderBy('SUM(item.total)', 'DESC')
      .take(limit)
      .getRawMany<{ name: string; quantity: string; revenue: string }>();
  }

  private async countSales(businessId: string, from: Date, to: Date): Promise<number> {
    const row = await this.saleRepo
      .createQueryBuilder('sale')
      .select('COUNT(*)', 'count')
      .where('sale.businessId = :businessId', { businessId })
      .andWhere("sale.payment_status != 'CANCELLED'")
      .andWhere('sale.created_at >= :from', { from })
      .andWhere('sale.created_at < :to', { to })
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }
}
