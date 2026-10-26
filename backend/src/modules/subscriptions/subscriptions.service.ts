import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, LessThan, MoreThan, Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../products/entities/product.entity';

const DAY = 86_400_000;
/** "Expiring soon" window shown on the dashboard and calls list. */
export const EXPIRING_DAYS = 7;

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED';

export function subscriptionStatus(expiresAt: Date, now = Date.now()): SubscriptionStatus {
  const t = expiresAt.getTime();
  if (t <= now) return 'EXPIRED';
  if (t - now <= EXPIRING_DAYS * DAY) return 'EXPIRING';
  return 'ACTIVE';
}

export interface PackageLine {
  productId: string;
  name: string;
  speedMbps: number | null;
  billingDays: number;
  unitPrice: number;
  quantity: number;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription) private readonly repo: Repository<Subscription>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  /**
   * Adds a subscriber who is already connected (no sale): the package runs
   * for its billing days from the start date. New paying clients go through
   * a package sale instead, which also records the money.
   */
  async create(businessId: string, input: { customerId: string; productId: string; startedAt?: string }) {
    const customer = await this.customerRepo.findOne({ where: { businessId, id: input.customerId } });
    if (!customer) throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Client not found.' });
    const pkg = await this.productRepo.findOne({ where: { businessId, id: input.productId } });
    if (!pkg || !pkg.billing_days) {
      throw new BadRequestException({ code: 'NOT_A_PACKAGE', message: 'Choose a WiFi package.' });
    }
    if (await this.repo.findOne({ where: { businessId, customerId: customer.id } })) {
      throw new ConflictException({
        code: 'ALREADY_SUBSCRIBED',
        message: `${customer.name} already has a WiFi package. Renew it from their page instead.`,
      });
    }
    const start = input.startedAt ? new Date(input.startedAt) : new Date();
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException({ code: 'INVALID_DATE', message: 'Enter a valid start date.' });
    }
    const sub = await this.repo.save(
      this.repo.create({
        businessId,
        customerId: customer.id,
        productId: pkg.id,
        package_name: pkg.name,
        speed_mbps: pkg.speed_mbps,
        price: pkg.selling_price,
        started_at: start,
        expires_at: new Date(start.getTime() + pkg.billing_days * DAY),
        renewals: 0,
        last_sale_id: null,
      }),
    );
    return {
      ...this.present(sub),
      customer: { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email },
    };
  }

  /**
   * Called inside the sale transaction for each WiFi package sold.
   * Still-active plans are extended from their current expiry (renewal);
   * lapsed or new clients start from now. Returns NEW or RENEWAL.
   */
  async applyPackageSale(
    manager: EntityManager,
    businessId: string,
    customerId: string,
    line: PackageLine,
    saleId: string,
  ): Promise<'NEW' | 'RENEWAL'> {
    const repo = manager.getRepository(Subscription);
    const existing = await repo.findOne({ where: { businessId, customerId } });
    const now = new Date();
    const days = line.billingDays * line.quantity;

    if (!existing) {
      await repo.save(
        repo.create({
          businessId,
          customerId,
          productId: line.productId,
          package_name: line.name,
          speed_mbps: line.speedMbps,
          price: line.unitPrice,
          started_at: now,
          expires_at: new Date(now.getTime() + days * DAY),
          renewals: 0,
          last_sale_id: saleId,
        }),
      );
      return 'NEW';
    }

    const base = existing.expires_at.getTime() > now.getTime() ? existing.expires_at.getTime() : now.getTime();
    const lapsed = existing.expires_at.getTime() <= now.getTime();
    Object.assign(existing, {
      productId: line.productId,
      package_name: line.name,
      speed_mbps: line.speedMbps,
      price: line.unitPrice,
      started_at: lapsed ? now : existing.started_at,
      expires_at: new Date(base + days * DAY),
      renewals: existing.renewals + 1,
      last_sale_id: saleId,
    });
    await repo.save(existing);
    return 'RENEWAL';
  }

  /** Cancelling a sale takes back the days that sale added. */
  async reversePackageSale(
    manager: EntityManager,
    businessId: string,
    customerId: string,
    billingDays: number,
    quantity: number,
  ) {
    const repo = manager.getRepository(Subscription);
    const existing = await repo.findOne({ where: { businessId, customerId } });
    if (!existing) return;
    existing.expires_at = new Date(existing.expires_at.getTime() - billingDays * quantity * DAY);
    existing.renewals = Math.max(0, existing.renewals - 1);
    await repo.save(existing);
  }

  /**
   * Sets the package a subscriber is on, as recorded in the billing system.
   * No sale: an existing plan keeps its dates and only changes package; a
   * subscriber without one starts today.
   */
  async setPackage(businessId: string, customerId: string, productId: string) {
    const existing = await this.repo.findOne({ where: { businessId, customerId } });
    if (!existing) return this.create(businessId, { customerId, productId });
    const pkg = await this.productRepo.findOne({ where: { businessId, id: productId } });
    if (!pkg || !pkg.billing_days) {
      throw new BadRequestException({ code: 'NOT_A_PACKAGE', message: 'Choose a WiFi package.' });
    }
    existing.productId = pkg.id;
    existing.package_name = pkg.name;
    existing.speed_mbps = pkg.speed_mbps;
    existing.price = pkg.selling_price;
    return this.present(await this.repo.save(existing));
  }

  async forCustomer(businessId: string, customerId: string) {
    const sub = await this.repo.findOne({ where: { businessId, customerId } });
    return sub ? this.present(sub) : null;
  }

  /** Subscribers with client details, optionally filtered by status. */
  async list(businessId: string, status?: SubscriptionStatus) {
    const subs = await this.repo.find({ where: { businessId }, order: { expires_at: 'ASC' } });
    const ids = subs.map((s) => s.customerId);
    const customers = ids.length ? await this.customerRepo.find({ where: { businessId, id: In(ids) } }) : [];
    const byId = new Map(customers.map((c) => [c.id, c]));
    return subs
      .map((s) => {
        const c = byId.get(s.customerId);
        return {
          ...this.present(s),
          customer: c ? { id: c.id, name: c.name, phone: c.phone, email: c.email } : null,
        };
      })
      .filter((s) => !status || s.status === status);
  }

  /**
   * The subscriber register: every client, newest first, with their account
   * details and package. Incomplete = phone or package still missing (e.g.
   * added automatically from a paybill payment with just an account number
   * and name); otherwise Active = package running, Inactive = package ran out.
   */
  async subscribers(businessId: string) {
    const [customers, subs] = await Promise.all([
      this.customerRepo.find({ where: { businessId }, order: { created_at: 'DESC' } }),
      this.repo.find({ where: { businessId } }),
    ]);
    const byCustomer = new Map(subs.map((s) => [s.customerId, s]));
    const now = Date.now();
    return customers.map((c) => {
      const s = byCustomer.get(c.id);
      const missing = [...(c.phone?.trim() ? [] : ['phone' as const]), ...(s ? [] : ['package' as const])];
      return {
        id: c.id,
        name: c.name,
        username: c.username,
        accountNumber: c.account_number,
        phone: c.phone,
        location: c.location,
        serviceType: c.service_type,
        router: c.router,
        wallet: c.wallet_balance,
        createdAt: c.created_at,
        packageName: s?.package_name ?? null,
        price: s?.price ?? null,
        expiresAt: s?.expires_at ?? null,
        daysLeft: s ? Math.ceil((s.expires_at.getTime() - now) / DAY) : null,
        missing,
        status: missing.length ? 'INCOMPLETE' : s!.expires_at.getTime() > now ? 'ACTIVE' : 'INACTIVE',
      };
    });
  }

  async stats(businessId: string) {
    const now = new Date();
    const soon = new Date(now.getTime() + EXPIRING_DAYS * DAY);
    const [active, expiring, expired] = await Promise.all([
      this.repo.count({ where: { businessId, expires_at: MoreThan(soon) } }),
      this.repo
        .createQueryBuilder('s')
        .where('s.businessId = :businessId', { businessId })
        .andWhere('s.expires_at > :now AND s.expires_at <= :soon', { now, soon })
        .getCount(),
      this.repo.count({ where: { businessId, expires_at: LessThan(now) } }),
    ]);
    return { active: active + expiring, expiringSoon: expiring, expired };
  }

  private present(s: Subscription) {
    const status = subscriptionStatus(s.expires_at);
    const daysLeft = Math.ceil((s.expires_at.getTime() - Date.now()) / DAY);
    return {
      id: s.id,
      customerId: s.customerId,
      productId: s.productId,
      packageName: s.package_name,
      speedMbps: s.speed_mbps,
      price: s.price,
      startedAt: s.started_at,
      expiresAt: s.expires_at,
      renewals: s.renewals,
      status,
      daysLeft,
    };
  }
}
