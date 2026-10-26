import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { RecurringExpense } from './entities/recurring-expense.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Business } from '../businesses/entities/business.entity';
import { AuditService } from '../audit/audit.service';
import {
  CreateRecurringExpenseDto,
  UpdateRecurringExpenseDto,
} from './dto/recurring-expense.dto';

const DEFAULT_TZ = 'Africa/Nairobi';
/** Generated expenses are dated at this local hour on their day. */
const RUN_HOUR = 9;

export type RecurringExpenseView = RecurringExpense & {
  category_name: string | null;
  next_run_date: string | null;
};

@Injectable()
export class RecurringExpensesService {
  private readonly logger = new Logger(RecurringExpensesService.name);

  constructor(
    @InjectRepository(RecurringExpense)
    private readonly repo: Repository<RecurringExpense>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    private readonly auditService: AuditService,
  ) {}

  async list(
    businessId: string,
    timezone = DEFAULT_TZ,
  ): Promise<RecurringExpenseView[]> {
    const result = await this.repo
      .createQueryBuilder('recurring')
      .leftJoin('categories', 'category', 'category.id = recurring.categoryId')
      .addSelect('category.name', 'category_name')
      .where('recurring.businessId = :businessId', { businessId })
      .orderBy('recurring.day_of_month', 'ASC')
      .addOrderBy('recurring.description', 'ASC')
      .getRawAndEntities();
    return result.entities.map((item, idx) =>
      Object.assign(item, {
        category_name:
          (result.raw[idx] as { category_name?: string }).category_name ?? null,
        next_run_date: this.nextRunDate(item, timezone),
      }),
    );
  }

  async get(businessId: string, id: string): Promise<RecurringExpense> {
    const item = await this.repo.findOne({ where: { id, businessId } });
    if (!item) {
      throw new NotFoundException({
        code: 'RECURRING_EXPENSE_NOT_FOUND',
        message: 'Recurring expense not found.',
      });
    }
    return item;
  }

  async create(
    businessId: string,
    dto: CreateRecurringExpenseDto,
    actorId: string,
    timezone = DEFAULT_TZ,
  ): Promise<RecurringExpense> {
    const item = this.repo.create({
      businessId,
      description: dto.description,
      amount: Math.round(dto.amount),
      categoryId: dto.categoryId ?? null,
      payment_method: dto.paymentMethod ?? 'BANK',
      day_of_month: dto.dayOfMonth,
      start_date:
        dto.startDate ?? DateTime.now().setZone(timezone).toISODate()!,
      end_date: dto.endDate ?? null,
      active: true,
      last_generated_month: null,
      createdById: actorId,
    });
    await this.repo.save(item);
    await this.auditService.log({
      businessId,
      userId: actorId,
      action: 'RECURRING_EXPENSE_CREATED',
      entity: 'recurring_expense',
      entityId: item.id,
      metadata: { description: item.description, amount: item.amount },
    });
    await this.generateForTemplate(item, timezone);
    return item;
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateRecurringExpenseDto,
    actorId: string,
  ): Promise<RecurringExpense> {
    const item = await this.get(businessId, id);
    Object.assign(item, {
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.amount !== undefined ? { amount: Math.round(dto.amount) } : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.paymentMethod !== undefined
        ? { payment_method: dto.paymentMethod }
        : {}),
      ...(dto.dayOfMonth !== undefined ? { day_of_month: dto.dayOfMonth } : {}),
      ...(dto.endDate !== undefined ? { end_date: dto.endDate } : {}),
    });
    await this.repo.save(item);
    await this.auditService.log({
      businessId,
      userId: actorId,
      action: 'RECURRING_EXPENSE_UPDATED',
      entity: 'recurring_expense',
      entityId: id,
      metadata: { amount: item.amount, dayOfMonth: item.day_of_month },
    });
    return item;
  }

  async setActive(
    businessId: string,
    id: string,
    active: boolean,
    actorId: string,
    timezone = DEFAULT_TZ,
  ): Promise<RecurringExpense> {
    const item = await this.get(businessId, id);
    item.active = active;
    if (active) {
      // Resuming does not back-fill the months it was paused for.
      const now = DateTime.now().setZone(timezone);
      const lastMonth = now.minus({ months: 1 }).toFormat('yyyy-MM');
      if (!item.last_generated_month || item.last_generated_month < lastMonth) {
        item.last_generated_month = lastMonth;
      }
    }
    await this.repo.save(item);
    await this.auditService.log({
      businessId,
      userId: actorId,
      action: active ? 'RECURRING_EXPENSE_RESUMED' : 'RECURRING_EXPENSE_PAUSED',
      entity: 'recurring_expense',
      entityId: id,
    });
    return item;
  }

  async remove(businessId: string, id: string, actorId: string): Promise<void> {
    const item = await this.get(businessId, id);
    await this.repo.remove(item);
    await this.auditService.log({
      businessId,
      userId: actorId,
      action: 'RECURRING_EXPENSE_DELETED',
      entity: 'recurring_expense',
      entityId: id,
      metadata: { description: item.description },
    });
  }

  /** Daily safety net; requests also catch up via generateDue(businessId). */
  @Cron('0 1 * * *')
  async generateAllDue(): Promise<void> {
    try {
      const created = await this.generateDue();
      if (created > 0) {
        this.logger.log(`Generated ${created} recurring expense(s).`);
      }
    } catch (err) {
      this.logger.error('Recurring expense generation failed', err as Error);
    }
  }

  /**
   * Creates every expense that has fallen due and not been generated yet.
   * Safe to call repeatedly and concurrently: each month is claimed with a
   * conditional update before its expense is written.
   */
  async generateDue(businessId?: string, timezone?: string): Promise<number> {
    const templates = await this.repo.find({
      where: { active: true, ...(businessId ? { businessId } : {}) },
    });
    if (templates.length === 0) return 0;

    const zones = new Map<string, string>();
    if (timezone && businessId) {
      zones.set(businessId, timezone);
    } else {
      const ids = [...new Set(templates.map((t) => t.businessId))];
      const businesses = await this.businessRepo.find({ where: { id: In(ids) } });
      for (const b of businesses) zones.set(b.id, b.timezone);
    }

    let created = 0;
    for (const template of templates) {
      created += await this.generateForTemplate(
        template,
        zones.get(template.businessId) ?? DEFAULT_TZ,
      );
    }
    return created;
  }

  private async generateForTemplate(
    template: RecurringExpense,
    timezone: string,
  ): Promise<number> {
    if (!template.active) return 0;
    const now = DateTime.now().setZone(timezone);
    const start = DateTime.fromISO(template.start_date, { zone: timezone }).startOf('day');
    const end = template.end_date
      ? DateTime.fromISO(template.end_date, { zone: timezone }).endOf('day')
      : null;

    let month = template.last_generated_month
      ? DateTime.fromFormat(template.last_generated_month, 'yyyy-MM', {
          zone: timezone,
        }).plus({ months: 1 })
      : start.startOf('month');

    let created = 0;
    while (true) {
      const runAt = month.set({
        day: template.day_of_month,
        hour: RUN_HOUR,
        minute: 0,
        second: 0,
        millisecond: 0,
      });
      if (runAt > now) break;
      if (end && runAt > end) break;

      const monthKey = month.toFormat('yyyy-MM');
      const claimed = await this.claimMonth(template, monthKey);
      if (!claimed) break; // another run got here first

      // The start month is skipped if the template began after its run day.
      if (runAt >= start) {
        await this.expenseRepo.save(
          this.expenseRepo.create({
            businessId: template.businessId,
            categoryId: template.categoryId,
            description: template.description,
            amount: template.amount,
            payment_method: template.payment_method,
            expense_date: runAt.toJSDate(),
            status: 'APPROVED',
            submittedById: template.createdById,
            reviewedById: template.createdById,
            reviewed_at: runAt.toJSDate(),
            recurringExpenseId: template.id,
          }),
        );
        created += 1;
      }
      month = month.plus({ months: 1 });
    }
    return created;
  }

  /** Atomically advances last_generated_month from its previous value. */
  private async claimMonth(
    template: RecurringExpense,
    monthKey: string,
  ): Promise<boolean> {
    const result = await this.repo.update(
      {
        id: template.id,
        last_generated_month:
          template.last_generated_month === null
            ? IsNull()
            : template.last_generated_month,
      },
      { last_generated_month: monthKey },
    );
    if (!result.affected) return false;
    template.last_generated_month = monthKey;
    return true;
  }

  private nextRunDate(
    template: RecurringExpense,
    timezone: string,
  ): string | null {
    if (!template.active) return null;
    const now = DateTime.now().setZone(timezone);
    const start = DateTime.fromISO(template.start_date, { zone: timezone });
    let month = template.last_generated_month
      ? DateTime.fromFormat(template.last_generated_month, 'yyyy-MM', {
          zone: timezone,
        }).plus({ months: 1 })
      : start.startOf('month');
    let runAt = month.set({ day: template.day_of_month });
    while (runAt.startOf('day') < start.startOf('day')) {
      month = month.plus({ months: 1 });
      runAt = month.set({ day: template.day_of_month });
    }
    if (runAt < now.startOf('day')) runAt = now.startOf('day');
    if (template.end_date && runAt.toISODate()! > template.end_date) return null;
    return runAt.toISODate();
  }
}
