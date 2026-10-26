import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { Budget } from './entities/budget.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Category } from '../categories/entities/category.entity';
import { AuditService } from '../audit/audit.service';
import { CreateBudgetDto, UpdateBudgetDto } from './dto/budget.dto';
import { monthRangeUtc } from '../../common/utils/dates';

export type BudgetLevel = 'OK' | 'WARNING' | 'EXCEEDED';

export interface BudgetStatus {
  id: string;
  categoryId: string;
  category_name: string;
  limit: number;
  alert_threshold: number;
  spent: number;
  remaining: number;
  percent: number;
  level: BudgetLevel;
}

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private readonly repo: Repository<Budget>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    private readonly auditService: AuditService,
  ) {}

  async list(businessId: string) {
    const result = await this.repo
      .createQueryBuilder('budget')
      .leftJoin('categories', 'category', 'category.id = budget.categoryId')
      .addSelect('category.name', 'category_name')
      .where('budget.businessId = :businessId', { businessId })
      .orderBy('category.name', 'ASC')
      .getRawAndEntities();
    return result.entities.map((budget, idx) =>
      Object.assign(budget, {
        category_name:
          (result.raw[idx] as { category_name?: string }).category_name ?? 'Uncategorized',
      }),
    );
  }

  async get(businessId: string, id: string): Promise<Budget> {
    const budget = await this.repo.findOne({ where: { id, businessId } });
    if (!budget) {
      throw new NotFoundException({
        code: 'BUDGET_NOT_FOUND',
        message: 'Budget not found.',
      });
    }
    return budget;
  }

  async create(
    businessId: string,
    dto: CreateBudgetDto,
    actorId: string,
  ): Promise<Budget> {
    const category = await this.categoryRepo.findOne({
      where: { id: dto.categoryId, businessId, type: 'EXPENSE' },
    });
    if (!category) {
      throw new BadRequestException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Pick an expense category for this budget.',
      });
    }
    // The unique constraint maps to 409 CONFLICT in the global filter.
    const budget = this.repo.create({
      businessId,
      categoryId: dto.categoryId,
      monthly_limit: Math.round(dto.monthlyLimit),
      alert_threshold: dto.alertThreshold ?? 80,
    });
    await this.repo.save(budget);
    await this.auditService.log({
      businessId,
      userId: actorId,
      action: 'BUDGET_CREATED',
      entity: 'budget',
      entityId: budget.id,
      metadata: { category: category.name, monthlyLimit: budget.monthly_limit },
    });
    return budget;
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateBudgetDto,
    actorId: string,
  ): Promise<Budget> {
    const budget = await this.get(businessId, id);
    const previous = budget.monthly_limit;
    if (dto.monthlyLimit !== undefined) budget.monthly_limit = Math.round(dto.monthlyLimit);
    if (dto.alertThreshold !== undefined) budget.alert_threshold = dto.alertThreshold;
    await this.repo.save(budget);
    await this.auditService.log({
      businessId,
      userId: actorId,
      action: 'BUDGET_UPDATED',
      entity: 'budget',
      entityId: id,
      metadata: { previous, current: budget.monthly_limit },
    });
    return budget;
  }

  async remove(businessId: string, id: string, actorId: string): Promise<void> {
    const budget = await this.get(businessId, id);
    await this.repo.remove(budget);
    await this.auditService.log({
      businessId,
      userId: actorId,
      action: 'BUDGET_DELETED',
      entity: 'budget',
      entityId: id,
    });
  }

  /** Spending against each budget for a month (YYYY-MM, default current). */
  async status(
    businessId: string,
    timezone: string,
    month?: string,
  ): Promise<{ month: string; items: BudgetStatus[] }> {
    const dt = month
      ? DateTime.fromFormat(month, 'yyyy-MM', { zone: timezone })
      : DateTime.now().setZone(timezone);
    const { start, end } = monthRangeUtc(dt.year, dt.month, timezone);

    const [budgets, spentRows] = await Promise.all([
      this.list(businessId),
      this.expenseRepo
        .createQueryBuilder('expense')
        .select('expense.categoryId', 'categoryId')
        .addSelect('COALESCE(SUM(expense.amount), 0)', 'spent')
        .where('expense.businessId = :businessId', { businessId })
        .andWhere("expense.status = 'APPROVED'")
        .andWhere('expense.expense_date >= :start', { start })
        .andWhere('expense.expense_date < :end', { end })
        .groupBy('expense.categoryId')
        .getRawMany<{ categoryId: string | null; spent: string }>(),
    ]);
    const spentByCategory = new Map(
      spentRows.map((r) => [r.categoryId, Number(r.spent)]),
    );

    const items = budgets.map((b): BudgetStatus => {
      const spent = spentByCategory.get(b.categoryId) ?? 0;
      const percent =
        b.monthly_limit > 0 ? Math.round((spent / b.monthly_limit) * 100) : 0;
      const level: BudgetLevel =
        spent > b.monthly_limit
          ? 'EXCEEDED'
          : percent >= b.alert_threshold
            ? 'WARNING'
            : 'OK';
      return {
        id: b.id,
        categoryId: b.categoryId,
        category_name: b.category_name,
        limit: b.monthly_limit,
        alert_threshold: b.alert_threshold,
        spent,
        remaining: b.monthly_limit - spent,
        percent,
        level,
      };
    });
    return { month: dt.toFormat('yyyy-MM'), items };
  }

  /** WARNING and EXCEEDED budgets for the current month, worst first. */
  async alerts(businessId: string, timezone: string): Promise<BudgetStatus[]> {
    const { items } = await this.status(businessId, timezone);
    return items
      .filter((i) => i.level !== 'OK')
      .sort((a, b) => b.percent - a.percent);
  }
}
