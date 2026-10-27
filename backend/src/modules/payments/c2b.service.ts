import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { timingSafeEqual } from 'node:crypto';
import { DateTime } from 'luxon';
import { MpesaC2bTransaction } from './entities/mpesa-c2b-transaction.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Product } from '../products/entities/product.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Business } from '../businesses/entities/business.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { SalesService } from '../sales/sales.service';
import { UserRole } from '../../common/types/auth-user.interface';
import { roundKES } from '../../common/utils/money';
import { accountKey, accountKeySql, normaliseAccountNumber } from '../customers/customers.service';
import { PaymentsService } from './payments.service';

/** The fields Safaricom posts to a C2B confirmation URL; the forwarder sends the same. */
export interface C2bPayload {
  TransactionType?: string;
  TransID?: string;
  TransTime?: string;
  TransAmount?: string | number;
  BusinessShortCode?: string;
  BillRefNumber?: string;
  InvoiceNumber?: string;
  OrgAccountBalance?: string;
  ThirdPartyTransID?: string;
  MSISDN?: string;
  FirstName?: string;
  MiddleName?: string;
  LastName?: string;
}

const ACCEPTED = { ResultCode: 0, ResultDesc: 'Accepted' };

/** Other names billing systems use for the same fields (matched ignoring case, "_" and "-"). */
const ALIASES: Record<keyof C2bPayload, string[]> = {
  TransactionType: ['transactiontype', 'type'],
  TransID: ['transid', 'transactionid', 'mpesacode', 'mpesareceiptnumber', 'receipt', 'receiptnumber', 'code'],
  TransTime: ['transtime', 'transactiontime', 'transactiondate', 'time'],
  TransAmount: ['transamount', 'amount'],
  BusinessShortCode: ['businessshortcode', 'shortcode', 'paybill'],
  BillRefNumber: ['billrefnumber', 'account', 'accountnumber', 'accountreference', 'billref', 'reference'],
  InvoiceNumber: ['invoicenumber', 'invoice'],
  OrgAccountBalance: ['orgaccountbalance', 'balance'],
  ThirdPartyTransID: ['thirdpartytransid'],
  MSISDN: ['msisdn', 'phone', 'phonenumber', 'mobile'],
  FirstName: ['firstname', 'first'],
  MiddleName: ['middlename', 'middle'],
  LastName: ['lastname', 'last', 'surname'],
};

/** A value cut to fit its column (a sender's long value must never make a payment fail), or null. */
function clip(value: string | number | undefined | null, max: number): string | null {
  const v = value === undefined || value === null ? '' : String(value).trim();
  return v ? v.slice(0, max) : null;
}

/** "JOHN  KAMAU" → "John Kamau". */
function titleCase(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());
}

/**
 * Paybill payments forwarded from the company's existing M-Pesa (Daraja)
 * setup. Every payment ends up in sales:
 * - Account number of a subscriber we have (FBI0001…): applied to their
 *   unpaid invoices first (oldest first), then a package renewal if what is
 *   left covers it, and anything over is kept as credit on their account.
 * - An account number we don't have yet (any format: the billing system sets
 *   the numbering): the subscriber is created from the payment (name and phone)
 *   and the money recorded as a sale for them.
 * - No account number (or a phone number typed as one): the payer is found by
 *   phone or added as a customer, and the money recorded as their sale.
 * Only a payment with no name and no usable phone stays unlinked.
 */
@Injectable()
export class C2bService {
  private readonly logger = new Logger(C2bService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly sales: SalesService,
    private readonly payments: PaymentsService,
    @InjectRepository(MpesaC2bTransaction) private readonly txRepo: Repository<MpesaC2bTransaction>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Sale) private readonly saleRepo: Repository<Sale>,
    @InjectRepository(Business) private readonly businessRepo: Repository<Business>,
    @InjectRepository(BusinessMember) private readonly memberRepo: Repository<BusinessMember>,
  ) {}

  private env(name: string): string {
    return (this.config.get<string>(name) ?? process.env[name] ?? '').trim();
  }

  /** The shared secret must match MPESA_WEBHOOK_SECRET (header or ?secret=). */
  assertSecret(given: string | undefined) {
    const expected = this.env('MPESA_WEBHOOK_SECRET');
    if (!expected) {
      throw new ServiceUnavailableException({ code: 'WEBHOOK_NOT_CONFIGURED', message: 'The M-Pesa webhook is not set up yet.' });
    }
    const a = Buffer.from(given ?? '');
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException({ code: 'BAD_WEBHOOK_SECRET', message: 'Wrong webhook secret.' });
    }
  }

  /**
   * The payment in Safaricom's field names, whatever names the sender used (TransID or transaction_id,
   * TransAmount or amount, BillRefNumber or account…). A body wrapped in { data: {...} } is unwrapped.
   */
  static normalisePayload(body: unknown): C2bPayload {
    const src = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const inner = src.data && typeof src.data === 'object' && !Array.isArray(src.data) ? (src.data as Record<string, unknown>) : null;
    const flat: Record<string, unknown> = { ...(inner ?? {}), ...src };
    const byKey = new Map<string, unknown>();
    for (const [k, v] of Object.entries(flat)) {
      if (v === null || v === undefined || typeof v === 'object') continue;
      const key = k.toLowerCase().replace(/[_\-\s]/g, '');
      if (!byKey.has(key)) byKey.set(key, v);
    }
    const out: C2bPayload = {};
    for (const [field, names] of Object.entries(ALIASES) as [keyof C2bPayload, string[]][]) {
      for (const n of names) {
        const v = byKey.get(n);
        if (v !== undefined && String(v).trim() !== '') {
          (out as Record<string, string>)[field] = String(v).trim();
          break;
        }
      }
    }
    return out;
  }

  /**
   * A hotspot purchase: the account is the router and the buyer's device, e.g. "ROUTER1,82:F8:E8:0B:BB:F2".
   * These are one-off sales, not subscribers.
   */
  static hotspotRef(ref: string): { router: string; mac: string | null } | null {
    const v = ref.trim();
    const mac = /([0-9A-F]{2}[:-]){5}[0-9A-F]{2}/i.exec(v)?.[0]?.toUpperCase() ?? null;
    const router = /^(ROUTER\s*\w*|HOTSPOT\s*\w*)\s*[,;|]/i.exec(v)?.[1]?.replace(/\s+/g, '').toUpperCase() ?? null;
    if (!mac && !router) return null;
    return { router: router ?? 'HOTSPOT', mac };
  }

  /**
   * Is what was typed in the account box a subscriber account number? Any format is accepted (the
   * billing system decides the numbering, not the SME's prefix): letters, digits and dashes with at
   * least one digit. A phone number typed as the account is not an account.
   */
  static isAccountNumber(ref: string): boolean {
    const v = ref.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9 /-]{0,39}$/.test(v) || !/\d/.test(v)) return false;
    const digits = v.replace(/\D/g, '');
    const looksLikePhone = digits === v.replace(/[\s-]/g, '') && /^(?:254|0)?[17]\d{8}$/.test(digits);
    return !looksLikePhone;
  }

  /** FBI-011, "fbi 011" and FBI011 are all written FBI011. */
  static normaliseAccount(ref: string): string {
    return normaliseAccountNumber(ref);
  }

  /** "20261017143005" (Nairobi time) → Date. */
  private transTime(value: string | undefined, timezone: string): Date | null {
    if (!value) return null;
    const t = DateTime.fromFormat(String(value), 'yyyyLLddHHmmss', { zone: timezone });
    return t.isValid ? t.toJSDate() : null;
  }

  private async targetBusiness(): Promise<Business | null> {
    const id = this.env('MPESA_C2B_BUSINESS_ID');
    if (id) return this.businessRepo.findOne({ where: { id } });
    // One company on this server: the first business created
    return this.businessRepo.findOne({ where: {}, order: { created_at: 'ASC' } });
  }

  private async matchCustomer(businessId: string, ref: string): Promise<Customer | null> {
    if (!ref.trim()) return null;
    const account = C2bService.normaliseAccount(ref);
    return (
      (await this.customerRepo
        .createQueryBuilder('c')
        .where('c.businessId = :businessId', { businessId })
        // Hyphens, spaces and leading zeros don't matter: FBI011 = FBI0011 = FBI-11
        .andWhere(`(${accountKeySql('c.account_number')} = :account OR UPPER(c.username) = :raw)`, {
          account: accountKey(account),
          raw: ref.trim().toUpperCase(),
        })
        .orderBy('c.created_at', 'ASC')
        .getOne()) ?? null
    );
  }

  async receive(body: C2bPayload | Record<string, unknown>, opts: { promptUnclaimed?: boolean } = {}) {
    const payload = C2bService.normalisePayload(body);
    const transId = String(payload.TransID ?? '').trim().toUpperCase();
    const amount = roundKES(Number(payload.TransAmount));
    if (!transId || !Number.isFinite(amount) || amount <= 0) {
      // Say what arrived, so a sender using other field names can be fixed quickly
      this.logger.warn(`M-Pesa webhook rejected: no transaction code or amount. Fields received: ${Object.keys((body ?? {}) as object).join(', ') || '(none)'}`);
      return { ResultCode: 1, ResultDesc: 'Rejected: a transaction code (TransID) and a positive amount (TransAmount) are required' };
    }
    // Sent before: already applied, just confirm
    if (await this.txRepo.findOne({ where: { trans_id: transId } })) return ACCEPTED;

    const business = await this.targetBusiness();
    if (!business) return { ResultCode: 1, ResultDesc: 'Rejected: no business on this server' };
    const owner = await this.memberRepo.findOne({ where: { businessId: business.id, role: UserRole.OWNER } });
    const actor = { userId: owner?.userId ?? '', role: UserRole.OWNER as string };

    const ref = String(payload.BillRefNumber ?? '').trim();
    const name = [payload.FirstName, payload.MiddleName, payload.LastName].filter(Boolean).join(' ').trim();
    let customer = await this.matchCustomer(business.id, ref);

    // The answer to a prompt sent from the app: whoever sent it records the sale
    const promptPhone = opts.promptUnclaimed
      ? null
      : this.payments.settleFromPaybill(
          { account: ref, phone: C2bService.localPhone(payload.MSISDN), amount, transId },
          async () => {
            await this.txRepo.delete({ trans_id: transId, status: 'PROMPT' });
            return this.receive(payload, { promptUnclaimed: true });
          },
        );
    if (promptPhone) {
      // The prompt went to a real number: keep it if the subscriber has none
      if (customer) await this.fillPhone(customer, C2bService.localPhone(promptPhone));
      await this.txRepo.save(
        this.txRepo.create({
          businessId: business.id,
          trans_id: transId.slice(0, 40),
          trans_time: this.transTime(payload.TransTime, business.timezone),
          amount,
          bill_ref: clip(ref, 60),
          short_code: clip(payload.BusinessShortCode, 20),
          msisdn: clip(payload.MSISDN, 128),
          payer_name: clip(name, 150),
          customerId: customer?.id ?? null,
          status: 'PROMPT',
          raw: body as Record<string, unknown>,
        }),
      );
      this.logger.log(`M-Pesa ${transId}: KES ${amount} for "${ref}" answers a prompt sent from the app`);
      return ACCEPTED;
    }

    let outcome: MpesaC2bTransaction['status'] = 'APPLIED';
    const hotspot = customer ? null : C2bService.hotspotRef(ref);
    if (customer) await this.fillPhone(customer, C2bService.localPhone(payload.MSISDN));
    if (hotspot) {
      // Hotspot buyers are one-off sales: no customer record per device
      outcome = 'HOTSPOT';
    } else if (!customer) {
      const phone = C2bService.localPhone(payload.MSISDN);
      const account = ref ? C2bService.normaliseAccount(ref) : '';
      if (C2bService.isAccountNumber(account)) {
        customer = await this.createSubscriber(business.id, account, name, phone, transId);
        outcome = 'NEW_ACCOUNT';
      } else if (phone) {
        customer = await this.findOrCreateCustomer(business.id, name, phone, ref, transId);
        outcome = 'CUSTOMER';
      } else {
        // A name alone (the phone is masked) can't tell people apart: record the sale with the name on it
        outcome = 'UNMATCHED';
      }
    }

    const tx = await this.txRepo.save(
      this.txRepo.create({
        businessId: business.id,
        trans_id: transId.slice(0, 40),
        trans_time: this.transTime(payload.TransTime, business.timezone),
        amount,
        bill_ref: clip(ref, 60),
        short_code: clip(payload.BusinessShortCode, 20),
        msisdn: clip(payload.MSISDN, 128),
        payer_name: clip(name, 150),
        customerId: customer?.id ?? null,
        status: 'PROCESSING',
        raw: body as Record<string, unknown>,
      }),
    );

    try {
      const saleIds =
        outcome === 'APPLIED' && customer
          ? await this.applyToCustomer(business, customer, amount, transId, actor)
          : outcome === 'NEW_ACCOUNT' && customer
            ? ((await this.sellPackageByAmount(business, customer, amount, transId, actor)) ??
              (await this.recordPaymentSale(business, amount, transId, ref, name, payload.MSISDN, customer, actor)))
            : await this.recordPaymentSale(business, amount, transId, ref, name, payload.MSISDN, customer, actor);
      tx.status = outcome;
      tx.sale_ids = saleIds;
      await this.txRepo.save(tx);
      const how = { APPLIED: '', NEW_ACCOUNT: ' (new subscriber)', CUSTOMER: ' (customer, no account)', UNMATCHED: '', HOTSPOT: '', PROCESSING: '', PROMPT: '' }[outcome];
      this.logger.log(
        `M-Pesa ${transId}: KES ${amount} for "${ref}" ${customer ? `→ ${customer.name}${how}` : outcome === 'HOTSPOT' ? `→ hotspot sale (${name || 'buyer'})` : `→ sale for ${name || 'unknown payer'} (no customer record)`}`,
      );
      return ACCEPTED;
    } catch (err) {
      // Not applied: drop the record so a resend is processed again (each step is idempotent)
      await this.txRepo.delete({ id: tx.id });
      this.logger.error(`M-Pesa ${transId} could not be applied`, err instanceof Error ? err.stack : String(err));
      throw err;
    }
  }

  private async applyToCustomer(
    business: Business,
    customer: Customer,
    amount: number,
    transId: string,
    actor: { userId: string; role: string },
  ): Promise<string[]> {
    let left = amount;
    const saleIds: string[] = [];

    // 1. Unpaid and part-paid invoices, oldest first
    const open = await this.saleRepo.find({
      where: {
        businessId: business.id,
        customerId: customer.id,
        payment_status: In(['UNPAID', 'PARTIAL']),
        sale_type: Not('ADVANCE'),
      },
      order: { created_at: 'ASC' },
    });
    for (const sale of open) {
      if (left <= 0) break;
      const detail = await this.sales.get(business.id, sale.id);
      const paid = (detail.payments ?? [])
        .filter((p) => p.status === 'SUCCESS')
        .reduce((sum, p) => sum + p.amount, 0);
      const due = sale.total - paid - (sale.advance_credit ?? 0);
      if (due <= 0) continue;
      const pay = Math.min(due, left);
      await this.sales.recordPayment(business.id, sale.id, { amount: pay, method: 'M-PESA', reference: transId }, actor);
      saleIds.push(sale.id);
      left -= pay;
    }

    // 2. What is left renews their package when it covers the price
    const sub = left > 0 ? await this.subRepo.findOne({ where: { businessId: business.id, customerId: customer.id } }) : null;
    if (left > 0 && !sub) {
      // No package on record yet: a payment of exactly one package's price starts that package
      const started = await this.sellPackageByAmount(business, customer, left, transId, actor);
      if (started) {
        saleIds.push(...started);
        left = 0;
      }
    }
    if (left > 0 && sub) {
      const pkg = sub ? await this.productRepo.findOne({ where: { businessId: business.id, id: sub.productId, active: true } }) : null;
      const price = pkg ? Math.max(0, pkg.selling_price - (customer.discount ?? 0)) : 0;
      if (pkg?.billing_days && price > 0 && left >= price) {
        const sale = await this.sales.create(
          business.id,
          {
            items: [{ productId: pkg.id, quantity: 1 }],
            saleType: 'PACKAGE',
            customerId: customer.id,
            discount: Math.min(customer.discount ?? 0, pkg.selling_price),
            paymentMethod: 'M-PESA',
            amountPaid: price,
            reference: transId,
            notes: `M-Pesa paybill ${transId}`,
            idempotencyKey: `mpesa-${transId}-package`,
          },
          actor,
          business.timezone,
        );
        saleIds.push(sale.id);
        left -= price;
      }
    }

    // 3. Anything over stays on their account as credit for next time
    if (left > 0) {
      const sale = await this.sales.create(
        business.id,
        {
          items: [],
          total: left,
          saleType: 'ADVANCE',
          customerId: customer.id,
          paymentMethod: 'M-PESA',
          amountPaid: left,
          reference: transId,
          notes: `M-Pesa paybill ${transId}: credit on account`,
          idempotencyKey: `mpesa-${transId}-credit`,
        },
        actor,
        business.timezone,
      );
      saleIds.push(sale.id);
    }
    return saleIds;
  }

  /** Saves the payer's number on their record when it has none yet. */
  private async fillPhone(customer: Customer, phone: string | null) {
    if (!phone || customer.phone?.trim()) return;
    customer.phone = phone;
    await this.customerRepo.update({ id: customer.id }, { phone });
  }

  /**
   * A subscriber with no package paid exactly the price of one package (and
   * only one has that price): sell them that package, which starts their
   * subscription. Null when the amount doesn't point to a single package.
   */
  private async sellPackageByAmount(
    business: Business,
    customer: Customer,
    amount: number,
    transId: string,
    actor: { userId: string; role: string },
  ): Promise<string[] | null> {
    const packages = (await this.productRepo.find({ where: { businessId: business.id, active: true } })).filter(
      (p) => (p.billing_days ?? 0) > 0 && Math.max(0, p.selling_price - (customer.discount ?? 0)) === amount,
    );
    if (packages.length !== 1) return null;
    const pkg = packages[0];
    const sale = await this.sales.create(
      business.id,
      {
        items: [{ productId: pkg.id, quantity: 1 }],
        saleType: 'PACKAGE',
        customerId: customer.id,
        discount: Math.min(customer.discount ?? 0, pkg.selling_price),
        paymentMethod: 'M-PESA',
        amountPaid: amount,
        reference: transId,
        notes: `M-Pesa paybill ${transId}: package ${pkg.name} (matched by amount)`,
        idempotencyKey: `mpesa-${transId}-package`,
      },
      actor,
      business.timezone,
    );
    this.logger.log(`M-Pesa ${transId}: ${customer.name} put on ${pkg.name} (KES ${amount} is its price)`);
    return [sale.id];
  }

  /**
   * The payer's number as 07XXXXXXXX, or null. Safaricom masks or hashes
   * MSISDN on some paybills, so anything that isn't a real number is ignored.
   */
  static localPhone(msisdn: string | undefined): string | null {
    const full = msisdn ? PaymentsService.normalisePhone(String(msisdn)) : null;
    return full ? `0${full.slice(3)}` : null;
  }

  /** Paid to an account number we don't have yet: add the subscriber. */
  private async createSubscriber(businessId: string, account: string, name: string, phone: string | null, transId: string) {
    const usernameTaken = await this.customerRepo
      .createQueryBuilder('c')
      .where('c.businessId = :businessId', { businessId })
      .andWhere('UPPER(c.username) = :account', { account })
      .getCount();
    const customer = await this.customerRepo.save(
      this.customerRepo.create({
        businessId,
        name: (name ? titleCase(name) : account).slice(0, 150),
        phone,
        account_number: account,
        username: usernameTaken ? null : account,
        notes: `Added automatically from M-Pesa payment ${transId}. Check the details and set their package.`,
      }),
    );
    this.logger.log(`New subscriber ${account} (${customer.name}) created from M-Pesa ${transId}`);
    return customer;
  }

  /** Paid without a subscriber account number: the customer with that phone, or a new one. */
  private async findOrCreateCustomer(businessId: string, name: string, phone: string | null, ref: string, transId: string) {
    if (phone) {
      const existing = await this.customerRepo
        .createQueryBuilder('c')
        .where('c.businessId = :businessId', { businessId })
        .andWhere(`RIGHT(REGEXP_REPLACE(COALESCE(c.phone, ''), '[^0-9]', '', 'g'), 9) = :last9`, { last9: phone.slice(1) })
        .orderBy('c.created_at', 'ASC')
        .getOne();
      if (existing) return existing;
    }
    return this.customerRepo.save(
      this.customerRepo.create({
        businessId,
        name: (name ? titleCase(name) : `M-Pesa ${phone}`).slice(0, 150),
        phone,
        notes: `Added automatically from M-Pesa payment ${transId}${ref ? ` (account typed: "${ref}")` : ''}.`,
      }),
    );
  }

  /** The whole payment as one paid sale, on the payer's record when there is one. */
  private async recordPaymentSale(
    business: Business,
    amount: number,
    transId: string,
    ref: string,
    name: string,
    msisdn: string | undefined,
    customer: Customer | null,
    actor: { userId: string; role: string },
  ): Promise<string[]> {
    const phone = C2bService.localPhone(msisdn);
    const from = `${name || 'unknown'}${phone ? ` (${phone})` : ''}`;
    const hotspot = customer ? null : C2bService.hotspotRef(ref);
    const sale = await this.sales.create(
      business.id,
      {
        items: [],
        total: amount,
        saleType: 'GENERAL',
        customerId: customer?.id,
        paymentMethod: 'M-PESA',
        amountPaid: amount,
        reference: transId,
        notes: customer
          ? `M-Pesa paybill ${transId} from ${from}, account "${ref || 'blank'}"`
          : hotspot
            ? `Hotspot ${hotspot.router}${hotspot.mac ? ` · device ${hotspot.mac}` : ''} · M-Pesa ${transId} from ${from}`
            : `M-Pesa paybill ${transId} from ${from}: account "${ref || 'blank'}"`,
        // Same key as before for payer-less payments, so a resend never doubles up
        idempotencyKey: customer ? `mpesa-${transId}-payment` : `mpesa-${transId}-unmatched`,
      },
      actor,
      business.timezone,
    );
    return [sale.id];
  }

  /** Latest paybill payments, for the office. */
  list(businessId: string, limit = 100) {
    return this.txRepo.find({
      where: { businessId },
      order: { created_at: 'DESC' },
      take: Math.min(500, Math.max(1, limit)),
      select: ['id', 'trans_id', 'trans_time', 'amount', 'bill_ref', 'msisdn', 'payer_name', 'customerId', 'status', 'sale_ids', 'created_at'],
    });
  }
}
