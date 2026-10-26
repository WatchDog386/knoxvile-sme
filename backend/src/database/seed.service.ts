import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User } from '../modules/users/entities/user.entity';
import { Business } from '../modules/businesses/entities/business.entity';
import { BusinessMember } from '../modules/businesses/entities/business-member.entity';
import { Category } from '../modules/categories/entities/category.entity';
import { Product } from '../modules/products/entities/product.entity';
import { Service } from '../modules/products/entities/service.entity';
import { Customer } from '../modules/customers/entities/customer.entity';
import { Sale } from '../modules/sales/entities/sale.entity';
import { SaleItem } from '../modules/sales/entities/sale-item.entity';
import { Expense } from '../modules/expenses/entities/expense.entity';
import { Budget } from '../modules/budgets/entities/budget.entity';
import { RecurringExpense } from '../modules/recurring-expenses/entities/recurring-expense.entity';
import { Payment } from '../modules/sales/entities/payment.entity';
import { Subscription } from '../modules/subscriptions/entities/subscription.entity';
import { CallLog } from '../modules/calls/entities/call-log.entity';
import { UserRole } from '../common/types/auth-user.interface';
import { currentMonthRangeUtc, todayRangeUtc } from '../common/utils/dates';
import { DateTime } from 'luxon';

// Deterministic pseudo-random generator so mock data is stable across restarts
let seedState = 1337;
const rand = (): number => {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
};
const randInt = (min: number, max: number): number =>
  min + Math.floor(rand() * (max - min + 1));
const pick = <T>(arr: Array<T>): T => arr[Math.floor(rand() * arr.length)];

interface CatalogItem {
  name: string;
  price: number;
}

// Every seeded test account logs in with this password
const DEMO_PASSWORD = 'fantes361';

interface DemoAccount {
  email: string;
  fullName: string;
  phone: string;
  business?: {
    name: string;
    type: string;
    // Showcase business always reports fixed figures for "today"
    showcase?: boolean;
    // `password` overrides the shared demo password for that account
    staff?: Array<{ email: string; fullName: string; phone: string; role: UserRole; password?: string }>;
  };
}

const COMPANY_NAME = 'Knoxville Technologies Ltd';

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'fanteskorri36@gmail.com',
    fullName: 'Felix Ochieng',
    phone: '+254712345679',
    business: {
      name: COMPANY_NAME,
      type: 'ELECTRONICS',
      showcase: true,
      staff: [
        // Company administrator: full Owner rights, own password
        {
          email: 'admin@knoxville.co.ke',
          fullName: 'Knoxville Admin',
          phone: '+254700100100',
          role: UserRole.OWNER,
          password: 'knoxville2026@!',
        },
        { email: 'korrifantes36@gmail.com', fullName: 'Korri Fantes', phone: '+254712345678', role: UserRole.OWNER },
        { email: 'manager@knoxville.local', fullName: 'Aisha Mohamed', phone: '+254700100200', role: UserRole.MANAGER },
        { email: 'sales@knoxville.local', fullName: 'Kevin Mutua', phone: '+254700100201', role: UserRole.EMPLOYEE },
        { email: 'accountant@knoxville.local', fullName: 'Lucy Wairimu', phone: '+254700100202', role: UserRole.ACCOUNTANT },
      ],
    },
  },
];

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Business) private readonly bizRepo: Repository<Business>,
    @InjectRepository(BusinessMember) private readonly memberRepo: Repository<BusinessMember>,
    @InjectRepository(Category) private readonly catRepo: Repository<Category>,
    @InjectRepository(Product) private readonly prodRepo: Repository<Product>,
    @InjectRepository(Service) private readonly serviceRepo: Repository<Service>,
    @InjectRepository(Customer) private readonly custRepo: Repository<Customer>,
    @InjectRepository(Sale) private readonly saleRepo: Repository<Sale>,
    @InjectRepository(SaleItem) private readonly itemRepo: Repository<SaleItem>,
    @InjectRepository(Expense) private readonly expRepo: Repository<Expense>,
    @InjectRepository(Budget) private readonly budgetRepo: Repository<Budget>,
    @InjectRepository(RecurringExpense)
    private readonly recurringRepo: Repository<RecurringExpense>,
    @InjectRepository(Payment) private readonly payRepo: Repository<Payment>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    @InjectRepository(CallLog) private readonly callRepo: Repository<CallLog>,
  ) {}

  async onModuleInit() {
    // Demo accounts share a known password, so production skips them unless
    // SEED_DEMO=true is set explicitly
    const seedDemo = process.env.SEED_DEMO
      ? process.env.SEED_DEMO === 'true'
      : process.env.NODE_ENV !== 'production';
    if (!seedDemo) return;
    try {
      for (const account of DEMO_ACCOUNTS) {
        await this.ensureAccount(account);
      }
    } catch (err) {
      this.logger.error('Error in SeedService:', err);
    }
  }

  private async ensureUser(email: string, fullName: string, phone: string, password = DEMO_PASSWORD) {
    const passwordHash = await bcrypt.hash(password, 10);
    let user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      user = this.userRepo.create({
        email,
        full_name: fullName,
        phone,
        password_hash: passwordHash,
        email_verified: true,
      });
      await this.userRepo.save(user);
      this.logger.log(`Created account ${email}`);
    } else {
      user.password_hash = passwordHash;
      await this.userRepo.save(user);
    }
    return user;
  }

  private async ensureAccount(account: DemoAccount) {
    const { email } = account;
    const user = await this.ensureUser(email, account.fullName, account.phone);

    if (!account.business) return;

    let member = await this.memberRepo.findOne({
      where: { userId: user.id, role: UserRole.OWNER },
    });
    let business: Business | null = null;

    if (!member) {
      business = this.bizRepo.create({
        name: account.business.name,
        business_type: account.business.type,
        currency: 'KES',
        timezone: 'Africa/Nairobi',
        ownerId: user.id,
      });
      await this.bizRepo.save(business);

      member = this.memberRepo.create({
        userId: user.id,
        businessId: business.id,
        role: UserRole.OWNER,
        status: 'ACTIVE',
      });
      await this.memberRepo.save(member);
    } else {
      business = await this.bizRepo.findOne({ where: { id: member.businessId } });
    }

    if (!business) return;

    // Older dev databases hold the previous demo shop — convert it to the company
    const renamed = business.name !== account.business.name;
    if (renamed) {
      business.name = account.business.name;
      business.business_type = account.business.type;
      await this.bizRepo.save(business);
    }

    const productCount = await this.prodRepo.count({ where: { businessId: business.id } });
    const saleCount = await this.saleRepo.count({ where: { businessId: business.id } });

    const richlySeeded = !renamed && productCount >= 10 && saleCount >= 20;

    if (!richlySeeded) {
      // Wipe any thin/partial mock data so we can rebuild cleanly
      await this.wipeBusinessData(business.id);

      const cats = await this.seedCategories(business.id);
      const products = await this.seedProducts(business.id, cats);
      const services = await this.seedServices(business.id, business.name, cats);
      const customers = await this.seedCustomers(business.id);
      await this.seedSales(business.id, products, services, customers);
      await this.seedExpenses(business.id, cats);

      this.logger.log(`Seeded full mock dataset for ${email}`);
    }

    for (const staff of account.business.staff ?? []) {
      await this.ensureStaff(business.id, staff);
    }

    // Showcase account always reports exact demo figures for today
    if (account.business.showcase) {
      await this.ensureIspCatalog(business.id);
      await this.applyDemoTodaySummary(business.id);
      await this.ensureExpenseWorkflowDemo(business.id, account.business.staff ?? []);
      await this.ensurePaymentsAndNumbers(business.id);
      await this.ensureDemoCalls(business.id, user.id);
    }
  }

  /**
   * Budgets, recurring templates and approval-queue items for the showcase
   * company. Runs once per business (skipped when budgets already exist).
   */
  private async ensureExpenseWorkflowDemo(
    businessId: string,
    staff: Array<{ email: string; role: UserRole }>,
  ) {
    if ((await this.budgetRepo.count({ where: { businessId } })) > 0) return;

    const cats = await this.catRepo.find({ where: { businessId, type: 'EXPENSE' } });
    const catId = (name: string) => cats.find((c) => c.name === name)?.id ?? null;
    const tz = 'Africa/Nairobi';

    // Limits are set against this month's spend so one category warns and one is over.
    const { start, end } = currentMonthRangeUtc(tz);
    const spentRows = await this.expRepo
      .createQueryBuilder('expense')
      .select('expense.categoryId', 'categoryId')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'spent')
      .where('expense.businessId = :businessId', { businessId })
      .andWhere("expense.status = 'APPROVED'")
      .andWhere('expense.expense_date >= :start', { start })
      .andWhere('expense.expense_date < :end', { end })
      .groupBy('expense.categoryId')
      .getRawMany<{ categoryId: string; spent: string }>();
    const spent = (name: string) =>
      Number(spentRows.find((r) => r.categoryId === catId(name))?.spent ?? 0);
    const roundUp = (v: number) => Math.max(1000, Math.ceil(v / 1000) * 1000);

    const utilities = spent('Utilities');
    const marketing = spent('Marketing');
    const budgetDefs: Array<[string, number]> = [
      ['Rent', 90000],
      ['Salaries', 200000],
      ['Stock Purchase', roundUp(spent('Stock Purchase') * 1.6 + 300000)],
      ['Transport', roundUp(spent('Transport') * 1.8 + 5000)],
      // About 85% used: shows as a warning
      ['Utilities', utilities > 0 ? Math.round(utilities / 0.85 / 100) * 100 : 15000],
      // Over budget
      ['Marketing', marketing > 2000 ? Math.floor((marketing * 0.8) / 500) * 500 : 8000],
    ];
    await this.budgetRepo.save(
      budgetDefs
        .filter(([name]) => catId(name))
        .map(([name, limit]) =>
          this.budgetRepo.create({
            businessId,
            categoryId: catId(name)!,
            monthly_limit: limit,
            alert_threshold: 80,
          }),
        ),
    );

    const userIdFor = async (role: UserRole) => {
      const email = staff.find((s) => s.role === role)?.email;
      if (!email) return null;
      return (await this.userRepo.findOne({ where: { email } }))?.id ?? null;
    };
    const ownerMember = await this.memberRepo.findOne({
      where: { businessId, role: UserRole.OWNER },
      order: { created_at: 'ASC' },
    });
    const employeeId = await userIdFor(UserRole.EMPLOYEE);
    const accountantId = await userIdFor(UserRole.ACCOUNTANT);

    // Seeded history already holds this month's fixed bills, so start next month.
    const now = DateTime.now().setZone(tz);
    const recurringDefs: Array<[string, number, string, string, number]> = [
      ['Office rent – Moi Avenue', 85000, 'Rent', 'BANK', 1],
      ['Internet – fibre 100Mbps', 8500, 'Utilities', 'M-PESA', 5],
      ['Staff salaries', 180000, 'Salaries', 'BANK', 28],
    ];
    await this.recurringRepo.save(
      recurringDefs.map(([description, amount, category, method, day]) =>
        this.recurringRepo.create({
          businessId,
          categoryId: catId(category),
          description,
          amount,
          payment_method: method,
          day_of_month: day,
          start_date: now.startOf('month').toISODate()!,
          end_date: null,
          active: true,
          last_generated_month: now.toFormat('yyyy-MM'),
          createdById: ownerMember?.userId ?? null,
        }),
      ),
    );

    if (!employeeId) return;
    // Dated before today, because applyDemoTodaySummary clears today's entries.
    const daysAgo = (n: number) => now.minus({ days: n }).set({ hour: 11 }).toJSDate();
    const queue: Array<Partial<Expense>> = [
      { description: 'Client site visit – Westlands (taxi)', amount: 1450, categoryId: catId('Transport'), payment_method: 'M-PESA', expense_date: daysAgo(1), status: 'PENDING' },
      { description: 'Ethernet crimping tool replacement', amount: 2800, categoryId: catId('Stock Purchase'), payment_method: 'CASH', expense_date: daysAgo(2), status: 'PENDING' },
      { description: 'Lunch with prospective client', amount: 3200, categoryId: catId('Marketing'), payment_method: 'CARD', expense_date: daysAgo(3), status: 'PENDING' },
      {
        description: 'Personal phone accessories',
        amount: 1900,
        categoryId: catId('Stock Purchase'),
        payment_method: 'CASH',
        expense_date: daysAgo(6),
        status: 'REJECTED',
        reviewedById: accountantId,
        reviewed_at: daysAgo(5),
        rejection_reason: 'Not a business expense – no receipt attached.',
      },
    ];
    await this.expRepo.save(
      queue.map((e) => this.expRepo.create({ ...e, businessId, submittedById: employeeId })),
    );
    this.logger.log('Seeded budgets, recurring expenses and approval queue');
  }

  private async ensureStaff(
    businessId: string,
    staff: { email: string; fullName: string; phone: string; role: UserRole; password?: string },
  ) {
    const user = await this.ensureUser(staff.email, staff.fullName, staff.phone, staff.password);
    const existing = await this.memberRepo.findOne({
      where: { userId: user.id, businessId },
    });
    if (existing) {
      existing.role = staff.role;
      existing.status = 'ACTIVE';
      await this.memberRepo.save(existing);
      return;
    }
    await this.memberRepo.save(
      this.memberRepo.create({ userId: user.id, businessId, role: staff.role, status: 'ACTIVE' }),
    );
  }

  /**
   * Keeps "today" populated for the showcase company with a fixed set of sales and expenses.
   */
  private async applyDemoTodaySummary(businessId: string) {
    const { start } = todayRangeUtc('Africa/Nairobi');

    // Remove anything already recorded today so the figures are exact
    const todaysSales = await this.saleRepo.find({
      where: { businessId, created_at: MoreThanOrEqual(start) },
      select: ['id'],
    });
    if (todaysSales.length > 0) {
      await this.payRepo.delete({ saleId: In(todaysSales.map((s) => s.id)) });
      await this.itemRepo.delete({ saleId: In(todaysSales.map((s) => s.id)) });
      await this.saleRepo.delete(todaysSales.map((s) => s.id));
    }
    await this.expRepo.delete({
      businessId,
      expense_date: MoreThanOrEqual(start),
    });

    const [products, services, customers] = await Promise.all([
      this.prodRepo.find({ where: { businessId } }),
      this.serviceRepo.find({ where: { businessId } }),
      this.custRepo.find({ where: { businessId } }),
    ]);
    const prod = (name: string) => products.find((p) => p.name === name);
    const svc = (name: string) => services.find((s) => s.name === name);
    const cust = (name: string | null) =>
      name ? customers.find((c) => c.name === name) ?? null : null;

    // Internet provider day: package renewals and new connections
    type DemoLine = { name: string; type: 'PRODUCT' | 'SERVICE'; qty: number; event?: 'NEW' | 'RENEWAL' };
    const demoSales: Array<{ time: string; customer: string | null; method: string; discount: number; lines: DemoLine[] }> = [
      {
        time: '08:40',
        customer: 'Riverside Hotel',
        method: 'BANK',
        discount: 0,
        lines: [{ name: 'Business 60 Mbps', type: 'PRODUCT', qty: 1, event: 'RENEWAL' }],
      },
      {
        time: '09:15',
        customer: 'Kilimani Academy',
        method: 'BANK',
        discount: 0,
        lines: [
          { name: 'Home 30 Mbps', type: 'PRODUCT', qty: 1, event: 'RENEWAL' },
          { name: 'Router Setup & Configuration', type: 'SERVICE', qty: 1 },
        ],
      },
      {
        time: '10:05',
        customer: 'Grace Achieng',
        method: 'M-PESA',
        discount: 0,
        lines: [
          { name: 'Home 25 Mbps', type: 'PRODUCT', qty: 1, event: 'NEW' },
          { name: 'Home Installation (Wireless)', type: 'SERVICE', qty: 1 },
          { name: 'TP-Link Archer C6 Router', type: 'PRODUCT', qty: 1 },
        ],
      },
      {
        time: '11:30',
        customer: 'Peter Kamau',
        method: 'M-PESA',
        discount: 0,
        lines: [{ name: 'Home 15 Mbps', type: 'PRODUCT', qty: 1, event: 'RENEWAL' }],
      },
      {
        time: '12:20',
        customer: 'Halima Yusuf',
        method: 'M-PESA',
        discount: 0,
        lines: [{ name: 'Business 60 Mbps', type: 'PRODUCT', qty: 1, event: 'RENEWAL' }],
      },
      {
        time: '13:45',
        customer: 'Samuel Kiprop',
        method: 'CREDIT',
        discount: 0,
        lines: [{ name: 'Home 15 Mbps', type: 'PRODUCT', qty: 1, event: 'RENEWAL' }],
      },
      {
        time: '15:10',
        customer: 'Nairobi Fresh Supermarket',
        method: 'M-PESA',
        discount: 1000,
        lines: [
          { name: 'Home 30 Mbps', type: 'PRODUCT', qty: 1, event: 'NEW' },
          { name: 'Fibre Installation', type: 'SERVICE', qty: 1 },
        ],
      },
    ];

    for (const demo of demoSales) {
      const [hours, minutes] = demo.time.split(':').map(Number);
      const createdAt = new Date();
      createdAt.setHours(hours, minutes, 0, 0);
      if (createdAt.getTime() < start.getTime()) return;

      let subtotal = 0;
      const resolvedLines = demo.lines.map((line) => {
        const product = line.type === 'PRODUCT' ? prod(line.name) : undefined;
        const service = line.type === 'SERVICE' ? svc(line.name) : undefined;
        const unitPrice = (product?.selling_price ?? service?.price ?? 0) as number;
        const unitCost =
          product?.cost_price ?? Math.round((service?.price ?? 0) * 0.3);
        const total = unitPrice * line.qty;
        subtotal += total;
        return { product, service, line, unitPrice, unitCost, total };
      });
      const total = subtotal - demo.discount;

      const sale = await this.saleRepo.save(
        this.saleRepo.create({
          businessId,
          customerId: cust(demo.customer)?.id ?? null,
          subtotal,
          discount: demo.discount,
          tax: 0,
          total,
          payment_status: demo.method === 'CREDIT' ? 'UNPAID' : 'PAID',
          payment_method: demo.method,
          idempotency_key: crypto.randomUUID(),
        }),
      );
      // @CreateDateColumn overwrites the value on insert — backdate explicitly
      await this.saleRepo.update(sale.id, { created_at: createdAt } as any);

      for (const rl of resolvedLines) {
        await this.itemRepo.save(
          this.itemRepo.create({
            saleId: sale.id,
            productId: rl.product?.id ?? null,
            serviceId: rl.service?.id ?? null,
            item_name: rl.line.name,
            quantity: rl.line.qty,
            unit_price: rl.unitPrice,
            cost_price: rl.unitCost,
            total: rl.total,
            package_event: rl.line.event ?? null,
          }),
        );
      }
    }

    // A couple of everyday expenses for today
    const demoExpenses = [
      { description: 'Fibre splice repair – Westlands', amount: 2500, category: 'Fibre & Infrastructure', method: 'M-PESA' },
      { description: 'Technician fuel – installations', amount: 1500, category: 'Field Transport', method: 'M-PESA' },
    ];
    for (const def of demoExpenses) {
      const cat = await this.catRepo.findOne({
        where: { businessId, type: 'EXPENSE', name: def.category },
      });
      const date = new Date();
      date.setHours(12, 30, 0, 0);
      const expense = await this.expRepo.save(
        this.expRepo.create({
          businessId,
          categoryId: cat?.id ?? null,
          description: def.description,
          amount: def.amount,
          payment_method: def.method,
          expense_date: date,
        }),
      );
      await this.expRepo.update(expense.id, { created_at: date } as any);
    }

    this.logger.log(
      'Applied showcase sales and expenses for today',
    );
  }

  /**
   * Turns the showcase company into an internet provider without deleting
   * anything: WiFi packages, ISP services and expense categories, a
   * subscription per client, invoice details, and the old electronics demo
   * items switched off (inactive, still on record).
   */
  private async ensureIspCatalog(businessId: string) {
    const catDefs: Array<[string, string]> = [
      ['PRODUCT', 'Internet Packages'],
      ['PRODUCT', 'Routers & Equipment'],
      ['SERVICE', 'Installation & Setup'],
      ['SERVICE', 'Support & Maintenance'],
      ['EXPENSE', 'Bandwidth (Upstream)'],
      ['EXPENSE', 'Fibre & Infrastructure'],
      ['EXPENSE', 'Equipment Purchase'],
      ['EXPENSE', 'Field Transport'],
      ['EXPENSE', 'Licences & Fees'],
    ];
    for (const [type, name] of catDefs) {
      const exists = await this.catRepo.findOne({ where: { businessId, type: type as Category['type'], name } });
      if (!exists) await this.catRepo.save(this.catRepo.create({ businessId, type: type as Category['type'], name }));
    }
    const cats = await this.catRepo.find({ where: { businessId } });

    // Sample monthly WiFi packages: edit them in Products to match current Knoxville plans
    // (cost = estimated bandwidth cost per client)
    const packages: Array<[string, string, number, number, number]> = [
      ['Home 8 Mbps', 'PKG-HOME-08', 8, 1499, 600],
      ['Home 15 Mbps', 'PKG-HOME-15', 15, 1999, 800],
      ['Home 25 Mbps', 'PKG-HOME-25', 25, 2499, 1000],
      ['Home 30 Mbps', 'PKG-HOME-30', 30, 2999, 1200],
      ['Business 40 Mbps', 'PKG-BIZ-40', 40, 3999, 1600],
      ['Business 60 Mbps', 'PKG-BIZ-60', 60, 4999, 2000],
    ];
    for (const [name, sku, speed, price, cost] of packages) {
      const existing = await this.prodRepo.findOne({ where: { businessId, name } });
      if (existing) continue;
      await this.prodRepo.save(
        this.prodRepo.create({
          businessId,
          name,
          sku,
          categoryId: this.cat(cats, 'PRODUCT', 'Internet Packages'),
          cost_price: cost,
          selling_price: price,
          stock_quantity: 0,
          low_stock_threshold: 0,
          track_inventory: false,
          active: true,
          billing_days: 30,
          speed_mbps: speed,
        }),
      );
    }

    const equipment: Array<[string, string, number, number, number]> = [
      ['Ubiquiti LiteBeam 5AC Receiver', 'UBQ-LBE-5AC', 7000, 9500, 15],
      ['Fibre ONT Terminal', 'ONT-GPON-01', 4500, 6500, 20],
    ];
    for (const [name, sku, cost, price, stock] of equipment) {
      if (await this.prodRepo.findOne({ where: { businessId, name } })) continue;
      await this.prodRepo.save(
        this.prodRepo.create({
          businessId,
          name,
          sku,
          categoryId: this.cat(cats, 'PRODUCT', 'Routers & Equipment'),
          cost_price: cost,
          selling_price: price,
          stock_quantity: stock,
          low_stock_threshold: 4,
          track_inventory: true,
          active: true,
        }),
      );
    }

    const services: Array<[string, string, number, number]> = [
      ['Home Installation (Wireless)', 'Installation & Setup', 3000, 120],
      ['Fibre Installation', 'Installation & Setup', 5000, 180],
      ['Router Setup & Configuration', 'Installation & Setup', 1000, 45],
      ['Relocation of Connection', 'Installation & Setup', 2500, 120],
      ['Site Survey', 'Installation & Setup', 1000, 60],
      ['On-site Technical Support', 'Support & Maintenance', 1500, 60],
    ];
    for (const [name, category, price, minutes] of services) {
      if (await this.serviceRepo.findOne({ where: { businessId, name } })) continue;
      await this.serviceRepo.save(
        this.serviceRepo.create({
          businessId,
          name,
          description: `${name} by an Knoxville technician`,
          categoryId: this.cat(cats, 'SERVICE', category),
          price,
          duration_minutes: minutes,
          active: true,
        }),
      );
    }

    // Electronics-shop demo items no longer fit: switch them off (kept on record)
    const retiredProducts = [
      'HP ProBook 450 G10 Laptop', 'Dell Latitude 5440 Laptop', 'Lenovo ThinkCentre M70 Desktop',
      'Samsung 24" LED Monitor', 'HP LaserJet Pro M404dn Printer', 'HP 59A Toner Cartridge',
      'A4 Printing Paper (Ream)', 'Hikvision 4MP Dome Camera', 'Hikvision 8-Channel NVR',
      '1TB Surveillance Hard Drive', 'APC 1000VA UPS', 'Logitech Wireless Keyboard & Mouse',
      'Kingston 32GB Flash Drive', 'USB-C Laptop Charger 65W',
    ];
    const retiredServices = [
      'CCTV Installation (per camera)', 'Printer Setup & Networking', 'Laptop Repair & Servicing',
      'OS & Software Installation', 'Data Recovery', 'Monthly IT Support Contract',
    ];
    await this.prodRepo.update({ businessId, name: In(retiredProducts) }, { active: false });
    await this.serviceRepo.update({ businessId, name: In(retiredServices) }, { active: false });

    // Invoice details (placeholders the owner can edit)
    const business = await this.bizRepo.findOne({ where: { id: businessId } });
    if (business && !business.kra_pin) {
      Object.assign(business, {
        kra_pin: 'P051234567X',
        address: business.address ?? 'Nairobi, Kenya',
        phone: business.phone ?? '+254 726 818 938',
        email: business.email ?? 'billing@knoxville.co.ke',
        invoice_footer:
          'Pay via M-Pesa Paybill, Account: your Knoxville account number · Support +254 726 818 938 · Thank you for choosing Knoxville Technologies.',
      });
      await this.bizRepo.save(business);
    }

    // One subscription per client: mostly active, some due soon, a few lapsed
    if ((await this.subRepo.count({ where: { businessId } })) === 0) {
      const pkgs = await this.prodRepo.find({ where: { businessId, active: true } });
      const plan = (name: string) => pkgs.find((p) => p.name === name)!;
      const customers = await this.custRepo.find({ where: { businessId }, order: { created_at: 'ASC' } });
      const assignment: Array<[string, string, number]> = [
        ['Kilimani Academy', 'Home 30 Mbps', 21],
        ['Sunrise Pharmacy Ltd', 'Home 30 Mbps', -3],
        ['Mwangi & Associates Advocates', 'Home 30 Mbps', 2],
        ['Riverside Hotel', 'Business 60 Mbps', 27],
        ['Nairobi Fresh Supermarket', 'Home 30 Mbps', 30],
        ['Kiprop Logistics Ltd', 'Business 60 Mbps', -6],
        ['Grace Achieng', 'Home 25 Mbps', 30],
        ['Peter Kamau', 'Home 15 Mbps', 29],
        ['Halima Yusuf', 'Business 60 Mbps', 18],
        ['Samuel Kiprop', 'Home 15 Mbps', 1],
      ];
      for (const [customerName, pkgName, daysLeft] of assignment) {
        const customer = customers.find((c) => c.name === customerName);
        const pkg = plan(pkgName);
        if (!customer || !pkg) continue;
        const expires = new Date(Date.now() + daysLeft * 86400000);
        await this.subRepo.save(
          this.subRepo.create({
            businessId,
            customerId: customer.id,
            productId: pkg.id,
            package_name: pkg.name,
            speed_mbps: pkg.speed_mbps,
            price: pkg.selling_price,
            started_at: new Date(expires.getTime() - 90 * 86400000),
            expires_at: expires,
            renewals: 2,
            last_sale_id: null,
          }),
        );
      }
      // Give clients emails so invoices can be emailed in the demo
      for (const c of customers) {
        if (!c.email) {
          c.email = `${c.name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@example.co.ke`;
          await this.custRepo.save(c);
        }
      }
      this.logger.log('Seeded WiFi packages, ISP services and subscriptions');
    }
  }

  /**
   * Seeded sales were stored without payment rows; add them so receipts work,
   * then give every sale an invoice number and every payment a receipt number.
   */
  private async ensurePaymentsAndNumbers(businessId: string) {
    const sales = await this.saleRepo.find({ where: { businessId }, order: { created_at: 'ASC' } });
    const withPayments = new Set(
      (await this.payRepo.find({ where: { businessId }, select: ['saleId'] })).map((p) => p.saleId),
    );
    for (const sale of sales) {
      if (withPayments.has(sale.id) || sale.payment_status === 'CANCELLED') continue;
      const amount =
        sale.payment_status === 'PAID' ? sale.total : sale.payment_status === 'PARTIAL' ? Math.round(sale.total / 2) : 0;
      if (amount <= 0) continue;
      await this.payRepo.save(
        this.payRepo.create({
          businessId,
          saleId: sale.id,
          customerId: sale.customerId,
          amount,
          method: sale.payment_method === 'CREDIT' ? 'M-PESA' : sale.payment_method,
          reference: sale.payment_method === 'M-PESA' ? `S${sale.id.replace(/-/g, '').slice(0, 9).toUpperCase()}` : null,
          status: 'SUCCESS',
          transaction_date: sale.created_at,
        }),
      );
    }

    let nextSale =
      Number((await this.saleRepo.createQueryBuilder('s').select('COALESCE(MAX(s.number),0)', 'm').where('s.businessId = :businessId', { businessId }).getRawOne<{ m: string }>())?.m ?? 0) + 1;
    for (const sale of sales.filter((x) => x.number == null)) {
      await this.saleRepo.update(sale.id, { number: nextSale++ });
    }
    const payments = await this.payRepo.find({ where: { businessId }, order: { transaction_date: 'ASC' } });
    let nextReceipt = Math.max(0, ...payments.map((p) => p.receipt_number ?? 0)) + 1;
    for (const pay of payments.filter((x) => x.receipt_number == null)) {
      await this.payRepo.update(pay.id, { receipt_number: nextReceipt++ });
    }
  }

  /** A couple of logged calls with call-backs due today, so the calls list isn't empty. */
  private async ensureDemoCalls(businessId: string, userId: string) {
    if ((await this.callRepo.count({ where: { businessId } })) > 0) return;
    const customers = await this.custRepo.find({ where: { businessId } });
    const find = (name: string) => customers.find((c) => c.name === name);
    const today = new Date();
    today.setHours(15, 0, 0, 0);
    const defs: Array<[string, CallLog['outcome'], string, Date | null]> = [
      ['Sunrise Pharmacy Ltd', 'PROMISED_TO_PAY', 'Accounts will pay the Business 30 renewal today via Paybill.', today],
      ['Kiprop Logistics Ltd', 'NO_ANSWER', 'Package lapsed — called to renew, no answer.', today],
      ['Peter Kamau', 'REACHED', 'Happy with Home Basic; may upgrade to Home Plus next month.', null],
    ];
    for (const [name, outcome, notes, followUp] of defs) {
      const c = find(name);
      if (!c) continue;
      await this.callRepo.save(
        this.callRepo.create({ businessId, customerId: c.id, userId, channel: 'PHONE', outcome, notes, follow_up_at: followUp, follow_up_done: false }),
      );
    }
  }

  private async wipeBusinessData(businessId: string) {
    const sales = await this.saleRepo.find({ where: { businessId }, select: ['id'] });
    if (sales.length > 0) {
      await this.itemRepo.delete({ saleId: In(sales.map((s) => s.id)) });
      await this.saleRepo.delete({ businessId });
    }
    await this.expRepo.delete({ businessId });
    await this.budgetRepo.delete({ businessId });
    await this.recurringRepo.delete({ businessId });
    await this.prodRepo.delete({ businessId });
    await this.serviceRepo.delete({ businessId });
    await this.custRepo.delete({ businessId });
    await this.catRepo.delete({ businessId });
  }

  private async seedCategories(businessId: string) {
    const defs: Array<{ type: string; name: string }> = [
      { type: 'PRODUCT', name: 'Laptops & Computers' },
      { type: 'PRODUCT', name: 'Printers & Office' },
      { type: 'PRODUCT', name: 'Networking' },
      { type: 'PRODUCT', name: 'CCTV & Security' },
      { type: 'PRODUCT', name: 'Power & Accessories' },
      { type: 'SERVICE', name: 'Installation' },
      { type: 'SERVICE', name: 'Repair & Support' },
      { type: 'EXPENSE', name: 'Rent' },
      { type: 'EXPENSE', name: 'Utilities' },
      { type: 'EXPENSE', name: 'Stock Purchase' },
      { type: 'EXPENSE', name: 'Transport' },
      { type: 'EXPENSE', name: 'Salaries' },
      { type: 'EXPENSE', name: 'Marketing' },
    ];
    return this.catRepo.save(
      defs.map((d) => this.catRepo.create({ ...d, businessId })),
    );
  }

  private cat(cats: Category[], type: string, name: string): string | null {
    return cats.find((c) => c.type === type && c.name === name)?.id ?? null;
  }

  private async seedProducts(businessId: string, cats: Category[]) {
    const defs = [
      ['HP ProBook 450 G10 Laptop', 'Laptops & Computers', 78000, 95000, 8, 2],
      ['Dell Latitude 5440 Laptop', 'Laptops & Computers', 82000, 99000, 6, 2],
      ['Lenovo ThinkCentre M70 Desktop', 'Laptops & Computers', 52000, 64000, 5, 2],
      ['Samsung 24" LED Monitor', 'Laptops & Computers', 14500, 19000, 12, 3],
      ['HP LaserJet Pro M404dn Printer', 'Printers & Office', 38000, 46500, 4, 2],
      ['HP 59A Toner Cartridge', 'Printers & Office', 9800, 12500, 15, 5],
      ['A4 Printing Paper (Ream)', 'Printers & Office', 520, 750, 80, 20],
      ['TP-Link Archer C6 Router', 'Networking', 4200, 5800, 20, 5],
      ['TP-Link 24-Port Gigabit Switch', 'Networking', 13500, 17500, 5, 2],
      ['Cat6 Cable 305m Box', 'Networking', 11500, 14800, 6, 2],
      ['RJ45 Connectors (100 pcs)', 'Networking', 650, 1000, 30, 10],
      ['Hikvision 4MP Dome Camera', 'CCTV & Security', 4800, 6800, 25, 6],
      ['Hikvision 8-Channel NVR', 'CCTV & Security', 13500, 18000, 4, 2],
      ['1TB Surveillance Hard Drive', 'CCTV & Security', 6200, 8500, 10, 3],
      ['APC 1000VA UPS', 'Power & Accessories', 14000, 18500, 7, 2],
      ['Logitech Wireless Keyboard & Mouse', 'Power & Accessories', 2600, 3800, 3, 5],
      ['Kingston 32GB Flash Drive', 'Power & Accessories', 450, 850, 60, 15],
      ['USB-C Laptop Charger 65W', 'Power & Accessories', 2200, 3500, 2, 5],
    ] as const;

    const products: Product[] = [];
    for (const [name, category, cost, sell, stock, threshold] of defs) {
      products.push(
        this.prodRepo.create({
          businessId,
          categoryId: this.cat(cats, 'PRODUCT', category),
          name,
          sku: name
            .replace(/[^a-zA-Z0-9 ]/g, '')
            .split(' ')
            .map((w) => w.slice(0, 3).toUpperCase())
            .join('-')
            .slice(0, 20),
          cost_price: cost as number,
          selling_price: sell as number,
          stock_quantity: stock as number,
          low_stock_threshold: threshold as number,
          track_inventory: true,
          active: true,
        }),
      );
    }
    return this.prodRepo.save(products);
  }

  private async seedServices(businessId: string, businessName: string, cats: Category[]) {
    const defs = [
      ['CCTV Installation (per camera)', 'Installation', 2500, 120],
      ['Network Cabling (per point)', 'Installation', 1800, 60],
      ['Printer Setup & Networking', 'Installation', 2000, 60],
      ['Laptop Repair & Servicing', 'Repair & Support', 3500, 90],
      ['OS & Software Installation', 'Repair & Support', 1500, 60],
      ['Data Recovery', 'Repair & Support', 6000, 180],
      ['Monthly IT Support Contract', 'Repair & Support', 15000, 480],
    ] as const;

    return this.serviceRepo.save(
      defs.map(([name, category, price, duration]) =>
        this.serviceRepo.create({
          businessId,
          categoryId: this.cat(cats, 'SERVICE', category),
          name,
          description: `${name} — professional service at ${businessName}`,
          price: price as number,
          duration_minutes: duration as number,
          active: true,
        }),
      ),
    );
  }

  private async seedCustomers(businessId: string) {
    const defs = [
      ['Kilimani Academy', '+254722134567', 486000, 0, 14],
      ['Sunrise Pharmacy Ltd', '+254733456789', 212500, 45000, 9],
      ['Mwangi & Associates Advocates', '+254711998877', 174000, 18500, 7],
      ['Riverside Hotel', '+254720555123', 391300, 0, 21],
      ['Nairobi Fresh Supermarket', '+254745666789', 98400, 0, 5],
      ['Kiprop Logistics Ltd', '+254798111222', 265200, 64500, 11],
      ['Grace Achieng', '+254701234098', 18900, 0, 3],
      ['Peter Kamau', '+254726888999', 104800, 0, 8],
      ['Halima Yusuf', '+254759777888', 23600, 0, 6],
      ['Samuel Kiprop', '+254710333444', 41400, 3500, 4],
    ] as const;

    const now = Date.now();
    return this.custRepo.save(
      defs.map(([name, phone, spent, owed, visits], i) =>
        this.custRepo.create({
          businessId,
          name,
          phone,
          email: null,
          address: i % 2 === 0 ? 'Nairobi' : 'Westlands, Nairobi',
          notes: null,
          total_spent: spent as number,
          outstanding_balance: owed as number,
          visit_count: visits as number,
          last_visit_at: new Date(now - randInt(0, 6) * 86400000),
        }),
      ),
    );
  }

  private async seedSales(
    businessId: string,
    products: Product[],
    services: Service[],
    customers: Customer[],
  ) {
    const now = new Date();
    const DAYS = 35;

    for (let dayOffset = DAYS; dayOffset >= 0; dayOffset--) {
      const dayDate = new Date(now.getTime() - dayOffset * 86400000);
      const weekday = dayDate.getDay(); // 0 Sun … 6 Sat
      const isWeekend = weekday === 0 || weekday === 6;
      const salesToday = dayOffset === 0 ? randInt(3, 4) : randInt(2, isWeekend ? 4 : 3);

      for (let s = 0; s < salesToday; s++) {
        const createdAt = new Date(dayDate);
        createdAt.setHours(randInt(8, 19), randInt(0, 59), randInt(0, 59), 0);

        const useCustomer = rand() < 0.55;
        const customer = useCustomer ? pick(customers) : null;
        const methodRoll = rand();
        const payment_method =
          methodRoll < 0.62 ? 'M-PESA' : methodRoll < 0.88 ? 'CASH' : methodRoll < 0.94 ? 'CARD' : 'CREDIT';

        const lineCount = randInt(1, 3);
        const chosen = new Set<string>();
        const lines: Array<{ item: CatalogItem; qty: number }> = [];
        for (let l = 0; l < lineCount; l++) {
          const useService = !useCustomer || rand() < 0.15 ? rand() < 0.2 : rand() < 0.08;
          const pool: Array<CatalogItem> = useService
            ? services.map((sv) => ({ name: sv.name, price: sv.price }))
            : products.map((p) => ({ name: p.name, price: p.selling_price }));
          const item = pick(pool);
          if (chosen.has(item.name)) continue;
          chosen.add(item.name);
          lines.push({ item, qty: randInt(1, 4) });
        }
        if (lines.length === 0) continue;

        const subtotal = lines.reduce((sum, l) => sum + l.item.price * l.qty, 0);
        const discount = rand() < 0.08 ? Math.round(subtotal * 0.05) : 0;
        const total = subtotal - discount;
        const payment_status =
          payment_method === 'CREDIT' ? (rand() < 0.5 ? 'PARTIAL' : 'UNPAID') : 'PAID';

        const sale = await this.saleRepo.save(
          this.saleRepo.create({
            businessId,
            customerId: customer?.id ?? null,
            subtotal,
            discount,
            tax: 0,
            total,
            payment_status,
            payment_method,
            idempotency_key: crypto.randomUUID(),
          }),
        );
        // @CreateDateColumn overwrites the value on insert — backdate explicitly
        await this.saleRepo.update(sale.id, { created_at: createdAt } as any);

        for (const line of lines) {
          const product = products.find((p) => p.name === line.item.name);
          const service = services.find((sv) => sv.name === line.item.name);
          await this.itemRepo.save(
            this.itemRepo.create({
              saleId: sale.id,
              productId: product?.id ?? null,
              serviceId: service?.id ?? null,
              item_name: line.item.name,
              quantity: line.qty,
              unit_price: line.item.price,
              cost_price: product?.cost_price ?? Math.round(line.item.price * 0.65),
              total: line.item.price * line.qty,
            }),
          );
        }
      }
    }
    this.logger.log(`Mock sales generated`);
  }

  private async seedExpenses(businessId: string, cats: Category[]) {
    const now = new Date();

    const fixedDefs = [
      ['Office rent – Moi Avenue', 85000, 'Rent', 'BANK', 32],
      ['Staff salaries', 180000, 'Salaries', 'BANK', 30],
      ['KPLC electricity bill', 9800, 'Utilities', 'M-PESA', 21],
      ['Nairobi Water bill', 1850, 'Utilities', 'M-PESA', 18],
      ['Stock purchase – laptops (distributor)', 410000, 'Stock Purchase', 'BANK', 15],
      ['Internet – fibre 100Mbps', 8500, 'Utilities', 'M-PESA', 12],
      ['Stock purchase – CCTV & networking', 126000, 'Stock Purchase', 'BANK', 9],
      ['Google & social media ads', 12000, 'Marketing', 'CARD', 7],
      ['Branded company profiles printing', 6500, 'Marketing', 'CASH', 5],
      ['Stock purchase – accessories', 38500, 'Stock Purchase', 'M-PESA', 4],
      ['KPLC prepaid tokens', 3000, 'Utilities', 'M-PESA', 3],
      ['Salary advance – technician', 10000, 'Salaries', 'M-PESA', 2],
    ];

    const variableDefs = [
      ['Site visit transport', 800, 'Transport'],
      ['Delivery to client (Uber/Bolt)', 650, 'Transport'],
      ['Courier – G4S parcel', 450, 'Transport'],
      ['Airtime & data bundles', 1000, 'Utilities'],
      ['M-Pesa transaction charges', 350, 'Utilities'],
      ['Packaging & labels', 900, 'Stock Purchase'],
      ['Technician lunch allowance', 600, 'Transport'],
    ];

    const expenses: Expense[] = [];

    for (const [description, amount, category, method, daysAgo] of fixedDefs) {
      const date = new Date(now.getTime() - (daysAgo as number) * 86400000);
      expenses.push(
        this.expRepo.create({
          businessId,
          categoryId: this.cat(cats, 'EXPENSE', category as string),
          description: description as string,
          amount: amount as number,
          payment_method: method as string,
          expense_date: date,
          created_at: date,
        }),
      );
    }

    for (let d = 0; d <= 34; d++) {
      if (rand() < 0.55) {
        const def = pick(variableDefs) as [string, number, string];
        const date = new Date(now.getTime() - d * 86400000);
        expenses.push(
          this.expRepo.create({
            businessId,
            categoryId: this.cat(cats, 'EXPENSE', def[2]),
            description: def[0],
            amount: def[1] + randInt(-50, 100),
            payment_method: pick(['CASH', 'M-PESA']),
            expense_date: date,
            created_at: date,
          }),
        );
      }
    }

    await this.expRepo.save(expenses);
    // @CreateDateColumn overwrites on insert — backdate created_at to match expense_date
    for (const expense of expenses) {
      if (expense.expense_date && expense.id) {
        await this.expRepo.update(expense.id, {
          created_at: expense.expense_date,
        } as any);
      }
    }
  }
}
