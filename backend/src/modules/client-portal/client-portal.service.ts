import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../products/entities/product.entity';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Payment } from '../sales/entities/payment.entity';
import { Business } from '../businesses/entities/business.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PaymentsService } from '../payments/payments.service';
import { SalesService } from '../sales/sales.service';
import { DocumentsService, DocKind } from '../documents/documents.service';
import { roundKES } from '../../common/utils/money';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '../../common/types/auth-user.interface';

/** What a client paid for with an M-Pesa prompt, so the sale is recorded once it's paid. */
interface PendingPay {
  businessId: string;
  customerId: string;
  userId: string;
  productId?: string;
  saleId?: string;
  recordedSaleId: string | null;
  recording?: Promise<string>;
}

/**
 * The client app: a WiFi client signs in and sees only their own package,
 * balance, payments and receipts, and can pay or renew with M-Pesa. Staff
 * create the client's login from the client's page.
 */
/** Internal login address for clients who sign in with their account number. */
const ACCOUNT_LOGIN_DOMAIN = 'account.knoxville.invalid';
function accountLoginEmail(customerId: string): string {
  return `client-${customerId}@${ACCOUNT_LOGIN_DOMAIN}`;
}
export function isAccountLogin(email: string): boolean {
  return email.endsWith(`@${ACCOUNT_LOGIN_DOMAIN}`);
}

/** Letters and digits without look-alikes (no O/0, l/1), so it reads over the phone. */
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** A temporary password the office reads out once; the client replaces it at first sign-in. */
export function generateTempPassword(length = 10): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => TEMP_PASSWORD_ALPHABET[b % TEMP_PASSWORD_ALPHABET.length]).join('');
}

@Injectable()
export class ClientPortalService {
  private readonly pending = new Map<string, PendingPay>();

  constructor(
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Sale) private readonly saleRepo: Repository<Sale>,
    @InjectRepository(SaleItem) private readonly saleItemRepo: Repository<SaleItem>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Business) private readonly businessRepo: Repository<Business>,
    @InjectRepository(BusinessMember) private readonly memberRepo: Repository<BusinessMember>,
    private readonly subscriptions: SubscriptionsService,
    private readonly payments: PaymentsService,
    private readonly sales: SalesService,
    private readonly documents: DocumentsService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  private async customer(businessId: string, customerId: string) {
    const customer = await this.customerRepo.findOne({ where: { businessId, id: customerId } });
    if (!customer) throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Your client record was not found.' });
    return customer;
  }

  /* ---------------- The client's own view ---------------- */

  async me(businessId: string, customerId: string) {
    const [customer, business, subscription, packages, sales] = await Promise.all([
      this.customer(businessId, customerId),
      this.businessRepo.findOne({ where: { id: businessId } }),
      this.subscriptions.forCustomer(businessId, customerId),
      this.productRepo.find({
        where: { businessId, active: true, billing_days: Not(IsNull()) },
        order: { selling_price: 'ASC' },
      }),
      this.saleRepo.find({
        where: { businessId, customerId },
        order: { created_at: 'DESC' },
        take: 50,
      }),
    ]);
    const saleIds = sales.map((sale) => sale.id);
    const [payments, saleItems] = saleIds.length ? await Promise.all([
      this.paymentRepo.find({ where: { businessId, saleId: In(saleIds), status: 'SUCCESS' } }),
      this.saleItemRepo.find({ where: { saleId: In(saleIds) } }),
    ]) : [[], []];
    return {
      business: { name: business?.name ?? 'Knoxville', phone: business?.phone ?? null, email: business?.email ?? null },
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        balance: customer.outstanding_balance,
        totalSpent: customer.total_spent,
      },
      subscription,
      packages: packages.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.selling_price,
        speedMbps: p.speed_mbps,
        billingDays: p.billing_days,
        description: p.description ?? null,
      })),
      payments: sales
        .filter((s) => s.payment_status !== 'CANCELLED')
        .map((s) => {
          const advanceCredit = s.advance_credit ?? 0;
          const cashPaid = payments.filter((payment) => payment.saleId === s.id).reduce((sum, payment) => sum + payment.amount, 0);
          const paid = cashPaid + advanceCredit;
          const packageItem = saleItems.find((item) =>
            item.saleId === s.id && item.productId &&
            (s.sale_type === 'PACKAGE' || packages.some((pkg) => pkg.id === item.productId)),
          );
          return {
            id: s.id,
            number: s.number,
            total: s.total,
            paid,
            balance: Math.max(0, s.total - paid),
            advanceCredit,
            advanceUsed: s.advance_used ?? 0,
            advanceAvailable: s.sale_type === 'ADVANCE' ? Math.max(0, s.total - (s.advance_used ?? 0)) : 0,
            status: s.payment_status,
            method: s.payment_method,
            at: s.created_at,
            packageName: packageItem?.item_name ?? null,
          };
        }),
    };
  }

  /** M-Pesa prompt to the client's phone for their package (or one they switch to). */
  async pay(
    businessId: string,
    customerId: string,
    userId: string,
    input: { productId?: string; saleId?: string; phone?: string; amount?: number },
  ) {
    const customer = await this.customer(businessId, customerId);
    if (input.saleId) {
      const sale = await this.saleRepo.findOne({ where: { businessId, id: input.saleId, customerId } });
      if (!sale || ['CANCELLED', 'REFUNDED', 'PAID'].includes(sale.payment_status)) {
        throw new BadRequestException({ code: 'SALE_NOT_PAYABLE', message: 'This invoice has no balance to pay.' });
      }
      const paidRow = await this.paymentRepo.createQueryBuilder('payment')
        .select('COALESCE(SUM(payment.amount), 0)', 'paid')
        .where('payment.businessId = :businessId AND payment.saleId = :saleId', { businessId, saleId: sale.id })
        .andWhere("payment.status = 'SUCCESS'")
        .getRawOne<{ paid: string }>();
      const balance = Math.max(0, sale.total - (sale.advance_credit ?? 0) - Number(paidRow?.paid ?? 0));
      const amount = input.amount == null ? balance : roundKES(input.amount);
      if (amount < 1 || amount > balance) {
        throw new BadRequestException({ code: 'INVALID_BALANCE_PAYMENT', message: `Enter an amount up to the outstanding KES ${balance.toLocaleString('en-KE')}.` });
      }
      const phone = input.phone?.trim() || customer.phone;
      if (!phone) throw new BadRequestException({ code: 'PHONE_REQUIRED', message: 'Enter your M-Pesa number.' });
      const push = await this.payments.stkPush(businessId, {
        phone,
        amount,
        reference: sale.number ? `INV${sale.number}` : 'Invoice balance',
        description: 'Invoice balance payment',
        account: customer.account_number,
      });
      this.pending.set(push.checkoutRequestId, { businessId, customerId, userId, saleId: sale.id, recordedSaleId: null });
      return push;
    }
    const current = await this.subscriptions.forCustomer(businessId, customerId);
    const productId = input.productId ?? current?.productId;
    if (!productId) throw new BadRequestException({ code: 'CHOOSE_PACKAGE', message: 'Choose a WiFi package to pay for.' });
    const pkg = await this.productRepo.findOne({ where: { businessId, id: productId, active: true } });
    if (!pkg || !pkg.billing_days) throw new BadRequestException({ code: 'NOT_A_PACKAGE', message: 'Choose a WiFi package.' });
    const phone = input.phone?.trim() || customer.phone;
    if (!phone) throw new BadRequestException({ code: 'PHONE_REQUIRED', message: 'Enter your M-Pesa number.' });
    // A client may pay part of a package, never more than it
    const amount = input.amount == null ? pkg.selling_price : roundKES(input.amount);
    if (amount < 1 || amount > pkg.selling_price) throw new BadRequestException({ code: 'INVALID_AMOUNT', message: `Enter an amount up to KES ${pkg.selling_price.toLocaleString('en-KE')}.` });

    const push = await this.payments.stkPush(businessId, {
      phone,
      amount,
      reference: pkg.name.split(/\s+/)[0],
      description: 'WiFi package',
      account: customer.account_number,
    });
    this.pending.set(push.checkoutRequestId, { businessId, customerId, userId, productId: pkg.id, recordedSaleId: null });
    return push;
  }

  /** Checks the prompt; once paid, records the package sale (renews the subscription) exactly once. */
  async payStatus(businessId: string, customerId: string, checkoutRequestId: string) {
    const entry = this.pending.get(checkoutRequestId);
    if (!entry || entry.businessId !== businessId || entry.customerId !== customerId) {
      throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'That payment was not found.' });
    }
    const status = await this.payments.stkStatus(businessId, checkoutRequestId);
    if (status.state === 'paid' && !entry.recordedSaleId) {
      if (!entry.recording) {
        entry.recording = (async () => {
          if (entry.saleId) {
            const sale = await this.sales.recordPayment(
              businessId,
              entry.saleId,
              { amount: status.amount, method: 'M-PESA', reference: status.receipt ?? checkoutRequestId, notes: 'Client invoice balance payment' },
              { userId: entry.userId },
            );
            return sale.id;
          }
          const sale = await this.sales.create(
            businessId,
            {
              items: [{ productId: entry.productId, quantity: 1 }],
              saleType: 'PACKAGE',
              customerId,
              paymentMethod: 'M-PESA',
              amountPaid: status.amount,
              reference: status.receipt ?? checkoutRequestId,
              notes: `Paid by the client in the app${status.receipt ? ` · M-Pesa ${status.receipt}` : ''}`,
              idempotencyKey: `stk-${checkoutRequestId}`,
            } as Parameters<SalesService['create']>[1],
            { userId: entry.userId, role: UserRole.CLIENT },
          );
          return sale.id;
        })().catch((error: unknown) => {
          entry.recording = undefined;
          throw error;
        });
      }
      entry.recordedSaleId = await entry.recording;
    }
    return { ...status, saleId: entry.recordedSaleId };
  }

  async document(businessId: string, customerId: string, saleId: string, kind: DocKind) {
    const sale = await this.saleRepo.findOne({ where: { businessId, id: saleId } });
    if (!sale || sale.customerId !== customerId) {
      throw new ForbiddenException({ code: 'NOT_YOURS', message: 'That document is not yours.' });
    }
    return this.documents.render(businessId, saleId, kind);
  }

  /* ---------------- Staff: the client's app login ---------------- */

  async getAccess(businessId: string, customerId: string) {
    await this.customer(businessId, customerId);
    const member = await this.memberRepo.findOne({
      where: { businessId, customerId, role: UserRole.CLIENT },
      relations: { user: true },
    });
    const customer = await this.customer(businessId, customerId);
    const email = member && !isAccountLogin(member.user.email) ? member.user.email : null;
    const login = { username: customer.username, accountNumber: customer.account_number };
    return member
      ? {
          enabled: member.status === 'ACTIVE',
          email,
          ...login,
          createdAt: member.created_at,
          mustChangePassword: member.user.must_change_password,
        }
      : { enabled: false, email: null, ...login, createdAt: null, mustChangePassword: false };
  }

  /**
   * Creates or resets a client's own app login. The office rarely types a
   * password: leave it out and one is generated here and returned once, so it
   * can be sent to the client (WhatsApp, SMS or read out). Either way the
   * client must replace it at their first sign-in.
   */
  async grantAccess(
    businessId: string,
    customerId: string,
    input: { email?: string; password?: string },
    actorId: string,
  ) {
    const customer = await this.customer(businessId, customerId);
    const realEmail = input.email?.trim().toLowerCase() || null;
    if (!realEmail && !customer.username && !customer.account_number) {
      throw new BadRequestException({
        code: 'USERNAME_REQUIRED',
        message: 'Give this subscriber a username first (Edit), or enter an email.',
      });
    }
    // No email: an internal address keeps the login unique; they sign in with their username
    const email = realEmail ?? accountLoginEmail(customerId);
    const password = input.password?.trim() || generateTempPassword();

    let user = await this.users.findByEmail(email);
    if (user) {
      // Only this client's own login may be reset here. Any other account
      // (staff, another client, or someone in a different business) is off
      // limits, or staff could set a password on an account that isn't theirs.
      const memberships = await this.memberRepo.find({ where: { userId: user.id } });
      const ownLogin = (m: BusinessMember) =>
        m.businessId === businessId && m.role === UserRole.CLIENT && m.customerId === customerId;
      // A login with no memberships is only reusable when it is this client's own internal one
      const reusable = memberships.length
        ? memberships.every(ownLogin)
        : email === accountLoginEmail(customerId);
      if (!reusable) {
        const sameBusiness = memberships.find((m) => m.businessId === businessId);
        throw new ConflictException({
          code: 'EMAIL_IN_USE',
          message:
            sameBusiness?.role === UserRole.CLIENT
              ? 'That email already signs in another client.'
              : 'That email already belongs to another account. Use a different email for the client.',
        });
      }
      // Existing login for this client: set the new password
      await this.users.update(user.id, {
        password_hash: await bcrypt.hash(password, 10),
        must_change_password: true,
        self_service_password_change_used: false,
      });
    } else {
      user = await this.users.create({
        email,
        fullName: customer.name,
        phone: customer.phone,
        passwordHash: await bcrypt.hash(password, 10),
        mustChangePassword: true,
      });
    }

    // One login per client: replace any older one
    const previous = await this.memberRepo.findOne({ where: { businessId, customerId, role: UserRole.CLIENT } });
    if (previous && previous.userId !== user.id) await this.memberRepo.remove(previous);

    const existing = await this.memberRepo.findOne({ where: { businessId, userId: user.id } });
    if (existing) {
      existing.status = 'ACTIVE';
      await this.memberRepo.save(existing);
    } else {
      await this.memberRepo.save(
        this.memberRepo.create({ businessId, userId: user.id, role: UserRole.CLIENT, customerId, status: 'ACTIVE' }),
      );
    }
    if (!customer.email && realEmail) await this.customerRepo.update(customer.id, { email: realEmail });

    await this.audit.log({
      businessId,
      userId: actorId,
      action: 'CLIENT_ACCESS_GRANTED',
      entity: 'customer',
      entityId: customerId,
      metadata: { email },
    });
    // The temporary password is handed back once: it is never stored in clear
    return { ...(await this.getAccess(businessId, customerId)), password };
  }

  async revokeAccess(businessId: string, customerId: string, actorId: string) {
    const member = await this.memberRepo.findOne({ where: { businessId, customerId, role: UserRole.CLIENT } });
    if (member) {
      member.status = 'DEACTIVATED';
      await this.memberRepo.save(member);
      await this.audit.log({
        businessId,
        userId: actorId,
        action: 'CLIENT_ACCESS_REVOKED',
        entity: 'customer',
        entityId: customerId,
        metadata: {},
      });
    }
    return this.getAccess(businessId, customerId);
  }
}
