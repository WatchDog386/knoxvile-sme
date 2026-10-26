import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, IsNull, Repository } from 'typeorm';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { Payment } from './entities/payment.entity';
import { CreateSaleDto, RecordPaymentDto } from './dto/sale.dto';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import { CustomersService } from '../customers/customers.service';
import { Product } from '../products/entities/product.entity';
import { Service } from '../products/entities/service.entity';
import { roundKES } from '../../common/utils/money';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { EntityManager } from 'typeorm';
import { DateTime } from 'luxon';
import { Category } from '../categories/entities/category.entity';
import { recordDateUtc } from '../../common/utils/dates';

interface ResolvedItem {
  /** CHARGE: an extra amount with no catalogue item, e.g. the installation fee. */
  type: 'PRODUCT' | 'SERVICE' | 'CHARGE';
  id: string;
  name: string;
  unitPrice: number;
  costPrice: number | null;
  quantity: number;
  total: number;
  /** Set for WiFi packages: days of access per unit. */
  billingDays: number | null;
  speedMbps: number | null;
}

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly itemRepo: Repository<SaleItem>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
    private readonly customersService: CustomersService,
    private readonly subscriptions: SubscriptionsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Next invoice (sale) or receipt (payment) number for a business. A
   * transaction-scoped lock stops two simultaneous sales getting the same one.
   */
  private async nextNumber(manager: EntityManager, businessId: string, kind: 'sale' | 'receipt'): Promise<number> {
    if (this.dataSource.options.type === 'postgres') {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${kind}:${businessId}`]);
    }
    const row =
      kind === 'sale'
        ? await manager
            .getRepository(Sale)
            .createQueryBuilder('s')
            .select('COALESCE(MAX(s.number), 0)', 'max')
            .where('s.businessId = :businessId', { businessId })
            .getRawOne<{ max: string }>()
        : await manager
            .getRepository(Payment)
            .createQueryBuilder('p')
            .select('COALESCE(MAX(p.receipt_number), 0)', 'max')
            .where('p.businessId = :businessId', { businessId })
            .getRawOne<{ max: string }>();
    return Number(row?.max ?? 0) + 1;
  }

  /**
   * Gives numbers to sales and payments that don't have one yet (older or
   * seeded records), oldest first, continuing after the highest number.
   */
  async assignMissingNumbers(businessId: string) {
    await this.dataSource.transaction(async (manager) => {
      const sales = await manager.getRepository(Sale).find({
        where: { businessId, number: IsNull() },
        order: { created_at: 'ASC' },
        select: ['id'],
      });
      if (sales.length) {
        let next = await this.nextNumber(manager, businessId, 'sale');
        for (const sale of sales) await manager.getRepository(Sale).update(sale.id, { number: next++ });
      }
      const payments = await manager.getRepository(Payment).find({
        where: { businessId, receipt_number: IsNull() },
        order: { transaction_date: 'ASC' },
        select: ['id'],
      });
      if (payments.length) {
        let next = await this.nextNumber(manager, businessId, 'receipt');
        for (const pay of payments) await manager.getRepository(Payment).update(pay.id, { receipt_number: next++ });
      }
    });
  }

  async resolveItems(
    businessId: string,
    items: CreateSaleDto['items'],
  ): Promise<ResolvedItem[]> {
    if (items.length === 0) {
      throw new BadRequestException({
        code: 'EMPTY_SALE',
        message: 'Add at least one product or service.',
      });
    }

    const productIds = items
      .filter((i) => i.productId)
      .map((i) => i.productId as string);
    const serviceIds = items
      .filter((i) => i.serviceId)
      .map((i) => i.serviceId as string);

    const [products, services] = await Promise.all([
      productIds.length
        ? this.productRepo.find({
            where: {
              id: In(productIds),
              businessId,
              active: true,
            },
          })
        : Promise.resolve([] as Product[]),
      serviceIds.length
        ? this.serviceRepo.find({
            where: {
              id: In(serviceIds),
              businessId,
              active: true,
            },
          })
        : Promise.resolve([] as Service[]),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    return items.map((item) => {
      if (item.productId && item.serviceId) {
        throw new BadRequestException({
          code: 'INVALID_ITEM',
          message: 'Each line item must be either a product or a service, not both.',
        });
      }
      if (item.productId) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new BadRequestException({
            code: 'PRODUCT_NOT_FOUND',
            message: 'A product in this sale could not be found or is inactive.',
          });
        }
        return {
          type: 'PRODUCT' as const,
          id: product.id,
          name: product.name,
          unitPrice: product.selling_price,
          costPrice: product.cost_price,
          quantity: item.quantity,
          total: roundKES(product.selling_price * item.quantity),
          billingDays: product.billing_days ?? null,
          speedMbps: product.speed_mbps ?? null,
        };
      }
      if (item.serviceId) {
        const service = serviceMap.get(item.serviceId);
        if (!service) {
          throw new BadRequestException({
            code: 'SERVICE_NOT_FOUND',
            message: 'A service in this sale could not be found or is inactive.',
          });
        }
        return {
          type: 'SERVICE' as const,
          id: service.id,
          name: service.name,
          unitPrice: service.price,
          costPrice: null,
          quantity: item.quantity,
          total: roundKES(service.price * item.quantity),
          billingDays: null,
          speedMbps: null,
        };
      }
      throw new BadRequestException({
        code: 'INVALID_ITEM',
        message: 'Each line item needs a product or service.',
      });
    });
  }

  computeTotals(
    items: ResolvedItem[],
    discount: number,
    taxRate: number,
  ): { subtotal: number; discount: number; tax: number; total: number } {
    const subtotal = roundKES(items.reduce((acc, i) => acc + i.total, 0));
    const appliedDiscount = Math.min(Math.max(0, roundKES(discount ?? 0)), subtotal);
    const taxBase = subtotal - appliedDiscount;
    const tax = roundKES((taxBase * (taxRate ?? 0)) / 100);
    const total = subtotal - appliedDiscount + tax;
    return { subtotal, discount: appliedDiscount, tax, total };
  }

  /**
   * New installation: the installation fee rides on a WiFi package sale as
   * its own line, so it shows on the receipt and in revenue.
   */
  private installationCharges(dto: CreateSaleDto, items: ResolvedItem[]): ResolvedItem[] {
    const fee = roundKES(dto.installationFee ?? 0);
    if (fee <= 0) return [];
    if (!items.some((i) => i.billingDays)) {
      throw new BadRequestException({
        code: 'INSTALLATION_NEEDS_PACKAGE',
        message: 'An installation charge can only be added to a WiFi package sale.',
      });
    }
    return [
      {
        type: 'CHARGE',
        id: 'installation',
        name: 'Installation fee',
        unitPrice: fee,
        costPrice: null,
        quantity: 1,
        total: fee,
        billingDays: null,
        speedMbps: null,
      },
    ];
  }

  private isAmountOnly(dto: CreateSaleDto): boolean {
    return (!dto.items || dto.items.length === 0) && !!dto.total;
  }

  async preview(businessId: string, dto: CreateSaleDto) {
    if (this.isAmountOnly(dto)) {
      const total = roundKES(dto.total as number);
      return {
        subtotal: total,
        discount: 0,
        tax: 0,
        total,
        items: [],
      };
    }
    const catalogue = await this.resolveItems(businessId, dto.items);
    const items = [...catalogue, ...this.installationCharges(dto, catalogue)];
    const totals = this.computeTotals(items, dto.discount ?? 0, dto.taxRate ?? 0);
    return {
      ...totals,
      items: items.map((i) => ({
        type: i.type,
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.total,
      })),
    };
  }

  async create(
    businessId: string,
    dto: CreateSaleDto,
    actor: { userId: string; role: string },
    timezone?: string,
  ): Promise<Sale & { items: SaleItem[]; payments: Payment[]; customer: { name: string } | null }> {
    const existing = await this.saleRepo.findOne({
      where: { businessId, idempotency_key: dto.idempotencyKey },
    });
    if (existing) {
      return this.get(businessId, existing.id);
    }

    // The day it was sold: today, or an earlier day picked by the person recording it
    const soldAt = recordDateUtc(dto.saleDate, timezone);
    if (dto.categoryId) {
      const category = await this.saleRepo.manager
        .getRepository(Category)
        .findOne({ where: { id: dto.categoryId, businessId, type: 'SALE' } });
      if (!category) {
        throw new BadRequestException({ code: 'CATEGORY_NOT_FOUND', message: 'That sales category was not found.' });
      }
    }

    const isAmountOnly = this.isAmountOnly(dto);
    if (!isAmountOnly && dto.items.length === 0) {
      throw new BadRequestException({
        code: 'EMPTY_SALE',
        message: 'Add at least one product or service.',
      });
    }

    const resolved = isAmountOnly
      ? []
      : await this.resolveItems(businessId, dto.items);
    if (isAmountOnly && dto.installationFee) {
      throw new BadRequestException({
        code: 'INSTALLATION_NEEDS_PACKAGE',
        message: 'An installation charge can only be added to a WiFi package sale.',
      });
    }
    // Extra lines with no catalogue item (installation fee); not used to infer the sale type
    const charges = this.installationCharges(dto, resolved);
    const totals = isAmountOnly
      ? {
          subtotal: roundKES(dto.total as number),
          discount: 0,
          tax: 0,
          total: roundKES(dto.total as number),
        }
      : this.computeTotals([...resolved, ...charges], dto.discount ?? 0, dto.taxRate ?? 0);

    if (totals.total === 0) {
      throw new BadRequestException({
        code: 'ZERO_TOTAL',
        message: 'The sale total cannot be zero.',
      });
    }

    const requestedAmount = roundKES(dto.amountPaid ?? (dto.paymentMethod === 'CREDIT' ? 0 : totals.total));
    if (requestedAmount > totals.total) {
      throw new BadRequestException({ code: 'OVERPAYMENT', message: 'The amount received cannot exceed the sale total.' });
    }
    if (requestedAmount < 0) {
      throw new BadRequestException({ code: 'INVALID_AMOUNT', message: 'The amount received cannot be negative.' });
    }
    if (dto.paymentMethod === 'CREDIT' && requestedAmount > 0) {
      throw new BadRequestException({ code: 'CREDIT_CANNOT_COLLECT', message: 'Choose a payment method for money received, or record this as credit with no payment.' });
    }
    const amountPaid = requestedAmount;
    let paymentStatus: string;
    if (dto.paymentMethod === 'CREDIT') {
      paymentStatus = amountPaid <= 0 ? 'UNPAID' : 'PARTIAL';
    } else {
      paymentStatus =
        amountPaid >= totals.total ? 'PAID' : amountPaid > 0 ? 'PARTIAL' : 'UNPAID';
    }

    if (dto.customerId) {
      await this.customersService.get(businessId, dto.customerId);
    }
    if (!dto.customerId && resolved.some((i) => i.billingDays)) {
      throw new BadRequestException({
        code: 'PACKAGE_NEEDS_CLIENT',
        message: 'Choose the client for this WiFi package so their subscription can be started or renewed.',
      });
    }

    let appliedAdvance = 0;
    const advanceAllocations: Array<{ saleId: string; amount: number }> = [];
    const sale = await this.dataSource.transaction(async (manager) => {
      const inferredType = isAmountOnly
        ? 'GENERAL'
        : resolved.length > 1 && new Set(resolved.map((item) => item.type === 'SERVICE' ? 'SERVICE' : item.billingDays ? 'PACKAGE' : 'PRODUCT')).size > 1
          ? 'MIXED'
          : resolved[0]?.type === 'SERVICE'
            ? 'SERVICE'
            : resolved[0]?.billingDays
              ? 'PACKAGE'
              : 'PRODUCT';
      const saleType = dto.saleType ?? inferredType;
      if (!isAmountOnly && saleType !== inferredType) {
        throw new BadRequestException({
          code: 'SALE_TYPE_ITEMS_MISMATCH',
          message: `This sale contains ${inferredType.toLowerCase()} items, so it must use the ${inferredType.toLowerCase()} category.`,
        });
      }
      if (!isAmountOnly && ['GENERAL', 'ADVANCE', 'OTHER'].includes(saleType)) {
        throw new BadRequestException({ code: 'SALE_TYPE_ITEMS_MISMATCH', message: 'General sales, advances, and other revenue must be recorded as an amount, without catalogue items.' });
      }
      if (isAmountOnly && !['GENERAL', 'ADVANCE', 'OTHER', 'PACKAGE'].includes(saleType)) {
        throw new BadRequestException({ code: 'SALE_TYPE_AMOUNT_MISMATCH', message: 'Choose a valid category for an amount-only sale.' });
      }
      if (saleType === 'ADVANCE' && !dto.customerId) {
        throw new BadRequestException({ code: 'ADVANCE_NEEDS_CLIENT', message: 'Choose the client who paid this advance.' });
      }
      if (['ADVANCE', 'OTHER'].includes(saleType) && !dto.notes?.trim()) {
        throw new BadRequestException({ code: 'SALE_DESCRIPTION_REQUIRED', message: 'Add what this advance is for or describe the other revenue source.' });
      }
      if (dto.applyAdvances && (!dto.customerId || !['PRODUCT', 'SERVICE'].includes(saleType))) {
        throw new BadRequestException({ code: 'ADVANCE_NOT_APPLICABLE', message: 'Advance credit can only be applied to this client’s product or service sale.' });
      }

      if (dto.applyAdvances && dto.customerId) {
        if (this.dataSource.options.type === 'postgres') {
          await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`customer-advance:${businessId}:${dto.customerId}`]);
        }
        const advances = await manager.getRepository(Sale).find({
          where: { businessId, customerId: dto.customerId, sale_type: 'ADVANCE', payment_status: 'PAID' },
          order: { created_at: 'ASC' },
        });
        let needed = Math.max(0, totals.total - amountPaid);
        for (const advance of advances) {
          const available = Math.max(0, advance.total - (advance.advance_used ?? 0));
          const use = Math.min(available, needed);
          if (use <= 0) continue;
          advance.advance_used = (advance.advance_used ?? 0) + use;
          await manager.save(advance);
          advanceAllocations.push({ saleId: advance.id, amount: use });
          appliedAdvance += use;
          needed -= use;
          if (needed <= 0) break;
        }
      }
      const collectedAndAdvanced = amountPaid + appliedAdvance;
      if (collectedAndAdvanced > totals.total) {
        throw new BadRequestException({ code: 'ADVANCE_OVERPAYMENT', message: 'The selected advance credit and new payment exceed the sale total.' });
      }
      paymentStatus = collectedAndAdvanced >= totals.total
        ? 'PAID'
        : collectedAndAdvanced > 0
          ? 'PARTIAL'
          : 'UNPAID';

      const saleEntity = manager.create(Sale, {
        number: await this.nextNumber(manager, businessId, 'sale'),
        businessId,
        customerId: dto.customerId ?? null,
        employeeId: dto.employeeId ?? null,
        sale_type: saleType,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        advance_credit: appliedAdvance,
        advance_used: 0,
        advance_allocations: advanceAllocations.length ? advanceAllocations : null,
        payment_status: paymentStatus,
        payment_method: dto.paymentMethod,
        notes: dto.notes ?? null,
        idempotency_key: dto.idempotencyKey,
        categoryId: dto.categoryId ?? null,
        created_at: soldAt,
      });
      await manager.save(saleEntity);

      const saleItems: SaleItem[] = [];
      for (const item of [...resolved, ...charges]) {
        // WiFi package: start or extend the client's subscription
        const packageEvent =
          item.billingDays && dto.customerId && paymentStatus === 'PAID'
            ? await this.subscriptions.applyPackageSale(
                manager,
                businessId,
                dto.customerId,
                {
                  productId: item.id,
                  name: item.name,
                  speedMbps: item.speedMbps,
                  billingDays: item.billingDays,
                  unitPrice: item.unitPrice,
                  quantity: item.quantity,
                },
                saleEntity.id,
              )
            : null;
        const saleItem = manager.create(SaleItem, {
          package_event: packageEvent,
          saleId: saleEntity.id,
          productId: item.type === 'PRODUCT' ? item.id : null,
          serviceId: item.type === 'SERVICE' ? item.id : null,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          cost_price: item.costPrice,
          total: item.total,
          item_name: item.name,
        });
        saleItems.push(await manager.save(saleItem));
      }

      if (amountPaid > 0) {
        const payment = manager.create(Payment, {
          receipt_number: await this.nextNumber(manager, businessId, 'receipt'),
          businessId,
          saleId: saleEntity.id,
          customerId: dto.customerId ?? null,
          amount: amountPaid,
          method: dto.paymentMethod,
          reference: dto.reference ?? null,
          status: 'SUCCESS',
          transaction_date: soldAt,
        });
        await manager.save(payment);
      }

      const movements = resolved
        .filter((item) => item.type === 'PRODUCT')
        .map((item) => ({
          productId: item.id,
          quantity: -item.quantity,
          type: 'SALE' as const,
          referenceId: saleEntity.id,
          reason: 'Sale deduction',
        }));
      if (movements.length) {
        await this.inventoryService.applyMovements(
          businessId,
          movements,
          actor.userId,
          manager,
        );
      }

      if (dto.customerId && saleType !== 'ADVANCE') {
        await this.customersService.adjustSpend(
          businessId,
          dto.customerId,
          totals.total,
          totals.total - amountPaid - appliedAdvance,
          true,
        );
      }

      await this.auditService.log({
        businessId,
        userId: actor.userId,
        action: 'SALE_CREATED',
        entity: 'sale',
        entityId: saleEntity.id,
        metadata: {
          total: saleEntity.total,
          paymentMethod: dto.paymentMethod,
          paymentStatus,
          amountPaid,
          advanceCredit: appliedAdvance,
          items: [...resolved, ...charges].map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
      });

      return saleEntity;
    });

    return this.get(businessId, sale.id);
  }

  async list(
    businessId: string,
    query: {
      page?: number;
      limit?: number;
      from?: string;
      to?: string;
      customerId?: string;
      paymentStatus?: string;
      paymentMethod?: string;
      saleType?: string;
      categoryId?: string;
      search?: string;
    },
    timezone = 'Africa/Nairobi',
  ): Promise<PaginatedResult<Sale & { customer_name: string | null; item_count: number }>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.saleRepo
      .createQueryBuilder('sale')
      .leftJoin('customers', 'customer', 'customer.id = sale.customerId')
      .addSelect('customer.name', 'customer_name')
      .leftJoin('categories', 'category', 'category.id = sale.categoryId')
      .addSelect('category.name', 'category_name')
      .addSelect(
        '(SELECT COUNT(*) FROM sale_items si WHERE si."saleId" = sale.id)',
        'item_count',
      )
      .addSelect(
        `(SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p."saleId" = sale.id AND p.status = 'SUCCESS')`,
        'amount_paid',
      )
      .where('sale.businessId = :businessId', { businessId });

    const boundary = (value: string) => {
      const parsed = DateTime.fromISO(value, { zone: timezone });
      return parsed.isValid ? parsed.toJSDate() : new Date(value);
    };
    if (query.from) qb.andWhere('sale.created_at >= :from', { from: boundary(query.from) });
    if (query.to) qb.andWhere('sale.created_at < :to', { to: boundary(query.to) });
    if (query.customerId) {
      qb.andWhere('sale.customerId = :customerId', { customerId: query.customerId });
    }
    if (query.paymentStatus) {
      qb.andWhere('sale.payment_status = :paymentStatus', {
        paymentStatus: query.paymentStatus,
      });
    }
    if (query.paymentMethod) qb.andWhere('sale.payment_method = :paymentMethod', { paymentMethod: query.paymentMethod });
    if (query.saleType) qb.andWhere('sale.sale_type = :saleType', { saleType: query.saleType });
    if (query.categoryId) qb.andWhere('sale.categoryId = :categoryId', { categoryId: query.categoryId });
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('customer.name LIKE :search', { search: `%${query.search}%` })
            .orWhere('sale.id LIKE :search', { search: `%${query.search}%` });
        }),
      );
    }

    const result = await qb
      .orderBy('sale.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getRawAndEntities();

    // Clear ORDER BY: Postgres rejects it on an aggregate-only query.
    const totalRow = await qb
      .clone()
      .orderBy()
      .select('COUNT(*)', 'count')
      .getRawOne<{ count: string }>();

    const items = result.entities.map((sale, idx) =>
      Object.assign(sale, {
        customer_name:
          (result.raw[idx] as { customer_name?: string }).customer_name ?? null,
        category_name:
          (result.raw[idx] as { category_name?: string }).category_name ?? null,
        item_count: Number(
          (result.raw[idx] as { item_count?: string }).item_count ?? 0,
        ),
        /** Collected so far, so invoices can show what is still due. */
        amount_paid: Number(
          (result.raw[idx] as { amount_paid?: string }).amount_paid ?? 0,
        ),
      }),
    );

    return { items, total: Number(totalRow?.count ?? 0), page, limit };
  }

  async availableAdvances(businessId: string, customerId: string) {
    await this.customersService.get(businessId, customerId);
    const sales = await this.saleRepo.find({
      where: { businessId, customerId, sale_type: 'ADVANCE', payment_status: 'PAID' },
      order: { created_at: 'ASC' },
    });
    const advances = sales
      .map((sale) => ({
        id: sale.id,
        number: sale.number,
        total: sale.total,
        used: sale.advance_used ?? 0,
        available: Math.max(0, sale.total - (sale.advance_used ?? 0)),
        purpose: sale.notes,
        created_at: sale.created_at,
      }))
      .filter((sale) => sale.available > 0);
    return { total: advances.reduce((sum, sale) => sum + sale.available, 0), advances };
  }

  async get(businessId: string, id: string) {
    const sale = await this.saleRepo.findOne({
      where: { id, businessId },
    });
    if (!sale) {
      throw new NotFoundException({
        code: 'SALE_NOT_FOUND',
        message: 'Sale not found.',
      });
    }

    const [itemResult, payments] = await Promise.all([
      this.itemRepo
        .createQueryBuilder('item')
        .leftJoin('products', 'product', 'product.id = item.productId')
        .leftJoin('services', 'service', 'service.id = item.serviceId')
        .addSelect('product.name', 'product_name')
        .addSelect('service.name', 'service_name')
        .where('item.saleId = :saleId', { saleId: id })
        .getRawAndEntities(),
      this.paymentRepo.find({
        where: { businessId, saleId: id },
        order: { created_at: 'ASC' },
      }),
    ]);

    const customer = sale.customerId
      ? await this.customersService
          .get(businessId, sale.customerId)
          .catch(() => null)
      : null;

    return Object.assign(sale, {
      customer,
      items: itemResult.entities.map((item, idx) =>
        Object.assign(item, {
          product_name:
            (itemResult.raw[idx] as { product_name?: string }).product_name ?? null,
          service_name:
            (itemResult.raw[idx] as { service_name?: string }).service_name ?? null,
        }),
      ),
      payments,
    });
  }

  async recordPayment(
    businessId: string,
    saleId: string,
    dto: RecordPaymentDto,
    actor: { userId: string },
  ) {
    const sale = await this.saleRepo.findOne({
      where: { id: saleId, businessId },
    });
    if (!sale) {
      throw new NotFoundException({
        code: 'SALE_NOT_FOUND',
        message: 'Sale not found.',
      });
    }
    if (sale.payment_status === 'CANCELLED' || sale.payment_status === 'REFUNDED') {
      throw new BadRequestException({
        code: 'SALE_CLOSED',
        message: 'This sale is closed and cannot receive payments.',
      });
    }

    if (dto.reference) {
      const prior = await this.paymentRepo.findOne({
        where: { businessId, saleId, reference: dto.reference, status: 'SUCCESS' },
      });
      if (prior) return this.get(businessId, saleId);
    }

    const alreadyPaid = await this.paymentRepo
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount), 0)', 'paid')
      .where('payment.saleId = :saleId', { saleId })
      .andWhere("payment.status = 'SUCCESS'")
      .getRawOne<{ paid: string }>();
    const paid = Number(alreadyPaid?.paid ?? 0);
    const remaining = sale.total - paid - (sale.advance_credit ?? 0);
    const amount = roundKES(dto.amount);

    if (amount <= 0) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Enter a valid amount.',
      });
    }
    if (amount > remaining) {
      throw new BadRequestException({
        code: 'OVERPAYMENT',
        message: `This sale only has KES ${remaining.toLocaleString('en-KE')} remaining.`,
      });
    }

    let duplicateReference = false;
    await this.dataSource.transaction(async (manager) => {
      if (this.dataSource.options.type === 'postgres') {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sale-payment:${saleId}`]);
      }
      if (dto.reference) {
        const prior = await manager.getRepository(Payment).findOne({
          where: { businessId, saleId, reference: dto.reference, status: 'SUCCESS' },
        });
        if (prior) {
          duplicateReference = true;
          return;
        }
      }
      const paidRow = await manager.getRepository(Payment).createQueryBuilder('payment')
        .select('COALESCE(SUM(payment.amount), 0)', 'paid')
        .where('payment.businessId = :businessId AND payment.saleId = :saleId', { businessId, saleId })
        .andWhere("payment.status = 'SUCCESS'")
        .getRawOne<{ paid: string }>();
      const paidInTransaction = Number(paidRow?.paid ?? 0);
      if (amount > sale.total - (sale.advance_credit ?? 0) - paidInTransaction) {
        throw new BadRequestException({
          code: 'OVERPAYMENT',
          message: `This sale only has KES ${Math.max(0, sale.total - (sale.advance_credit ?? 0) - paidInTransaction).toLocaleString('en-KE')} remaining.`,
        });
      }
      const payment = manager.create(Payment, {
        receipt_number: await this.nextNumber(manager, businessId, 'receipt'),
        businessId,
        saleId,
        customerId: sale.customerId,
        amount,
        method: dto.method,
        reference: dto.reference ?? null,
        status: 'SUCCESS',
        transaction_date: new Date(),
      });
      await manager.save(payment);

      const newPaid = paidInTransaction + (sale.advance_credit ?? 0) + amount;
      sale.payment_status = newPaid >= sale.total ? 'PAID' : 'PARTIAL';
      await manager.save(sale);

      // Start/extend package access only after the package invoice has been
      // fully paid. This also activates a package completed by a later top-up.
      if (sale.payment_status === 'PAID') {
        const items = await manager.getRepository(SaleItem).find({ where: { saleId } });
        const packageItems = items.filter((item) => item.productId && !item.package_event);
        if (packageItems.length && sale.customerId) {
          const products = await manager.getRepository(Product).find({
            where: { id: In(packageItems.map((item) => item.productId as string)), businessId },
          });
          for (const item of packageItems) {
            const product = products.find((candidate) => candidate.id === item.productId);
            if (!product?.billing_days) continue;
            item.package_event = await this.subscriptions.applyPackageSale(
              manager,
              businessId,
              sale.customerId,
              {
                productId: product.id,
                name: product.name,
                speedMbps: product.speed_mbps,
                billingDays: product.billing_days,
                unitPrice: item.unit_price,
                quantity: item.quantity,
              },
              saleId,
            );
            await manager.save(item);
          }
        }
      }

      if (sale.customerId) {
        await this.customersService.adjustSpend(
          businessId,
          sale.customerId,
          0,
          -amount,
          false,
        );
      }
    });

    if (duplicateReference) return this.get(businessId, saleId);

    await this.auditService.log({
      businessId,
      userId: actor.userId,
      action: 'PAYMENT_RECORDED',
      entity: 'sale',
      entityId: saleId,
      metadata: { amount, method: dto.method, reference: dto.reference },
    });

    return this.get(businessId, saleId);
  }

  async cancel(
    businessId: string,
    saleId: string,
    actor: { userId: string },
  ) {
    const sale = await this.saleRepo.findOne({
      where: { id: saleId, businessId },
    });
    if (!sale) {
      throw new NotFoundException({
        code: 'SALE_NOT_FOUND',
        message: 'Sale not found.',
      });
    }
    if (sale.payment_status === 'CANCELLED') {
      return this.get(businessId, saleId);
    }
    if (sale.sale_type === 'ADVANCE' && (sale.advance_used ?? 0) > 0) {
      throw new BadRequestException({
        code: 'ADVANCE_ALREADY_APPLIED',
        message: 'This advance has already been applied to a sale and cannot be cancelled.',
      });
    }

    const items = await this.itemRepo.find({ where: { saleId } });
    const alreadyPaid = await this.paymentRepo
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount), 0)', 'paid')
      .where('payment.saleId = :saleId', { saleId })
      .andWhere("payment.status = 'SUCCESS'")
      .getRawOne<{ paid: string }>();
    const paid = Number(alreadyPaid?.paid ?? 0);
    const unpaidBalance = Math.max(0, sale.total - paid - (sale.advance_credit ?? 0));

    await this.dataSource.transaction(async (manager) => {
      if (sale.customerId && this.dataSource.options.type === 'postgres') {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`customer-advance:${businessId}:${sale.customerId}`]);
      }
      const currentSale = await manager.getRepository(Sale).findOne({ where: { id: saleId, businessId } });
      if (currentSale?.sale_type === 'ADVANCE' && (currentSale.advance_used ?? 0) > 0) {
        throw new BadRequestException({ code: 'ADVANCE_ALREADY_APPLIED', message: 'This advance has already been applied to a sale and cannot be cancelled.' });
      }
      if (sale.customerId && (sale.advance_allocations ?? []).length) {
        for (const allocation of sale.advance_allocations ?? []) {
          const advance = await manager.getRepository(Sale).findOne({
            where: { id: allocation.saleId, businessId, customerId: sale.customerId, sale_type: 'ADVANCE' },
          });
          if (advance) {
            advance.advance_used = Math.max(0, (advance.advance_used ?? 0) - allocation.amount);
            await manager.save(advance);
          }
        }
      }
      const movements = items
        .filter((item) => item.productId)
        .map((item) => ({
          productId: item.productId as string,
          quantity: item.quantity,
          type: 'RETURN' as const,
          referenceId: sale.id,
          reason: 'Sale cancelled',
        }));
      if (movements.length) {
        await this.inventoryService.applyMovements(
          businessId,
          movements,
          actor.userId,
          manager,
        );
      }

      await manager.getRepository(Payment).update(
        { saleId, status: 'SUCCESS' },
        { status: 'REFUNDED' },
      );

      if (sale.customerId) {
        const packageItems = items.filter((i) => i.package_event && i.productId);
        if (packageItems.length) {
          const packages = await manager
            .getRepository(Product)
            .find({ where: { id: In(packageItems.map((i) => i.productId as string)) } });
          for (const item of packageItems) {
            const days = packages.find((p) => p.id === item.productId)?.billing_days;
            if (days) {
              await this.subscriptions.reversePackageSale(manager, businessId, sale.customerId, days, item.quantity);
            }
          }
        }
      }

      sale.payment_status = 'CANCELLED';
      sale.cancelled_at = new Date();
      sale.cancelled_by = actor.userId;
      await manager.save(sale);

      if (sale.customerId && sale.sale_type !== 'ADVANCE') {
        await this.customersService.adjustSpend(
          businessId,
          sale.customerId,
          -sale.total,
          -unpaidBalance,
          false,
        );
      }
    });

    await this.auditService.log({
      businessId,
      userId: actor.userId,
      action: 'SALE_CANCELLED',
      entity: 'sale',
      entityId: saleId,
      metadata: { total: sale.total, paid, refunded: paid, unpaidBalance },
    });

    return this.get(businessId, saleId);
  }
}
