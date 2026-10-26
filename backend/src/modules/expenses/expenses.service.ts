import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { recordDateUtc } from '../../common/utils/dates';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense, ExpenseStatus } from './entities/expense.entity';
import { AuditService } from '../audit/audit.service';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
} from './dto/expense.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { UserRole } from '../../common/types/auth-user.interface';
import { DateTime } from 'luxon';

/** Roles whose expenses are approved on entry and who review others' submissions. */
export const EXPENSE_APPROVER_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.ACCOUNTANT,
];

export interface ExpenseActor {
  id: string;
  role: UserRole;
}

function isApprover(role: UserRole): boolean {
  return EXPENSE_APPROVER_ROLES.includes(role);
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly repo: Repository<Expense>,
    private readonly auditService: AuditService,
  ) {}

  async list(
    businessId: string,
    query: {
      page?: number;
      limit?: number;
      from?: string;
      to?: string;
      categoryId?: string;
      search?: string;
      status?: ExpenseStatus;
      paymentMethod?: string;
    },
    actor?: ExpenseActor,
    timezone = 'Africa/Nairobi',
  ): Promise<PaginatedResult<Expense & { category_name: string | null }>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.repo
      .createQueryBuilder('expense')
      .leftJoin('categories', 'category', 'category.id = expense.categoryId')
      .addSelect('category.name', 'category_name')
      .where('expense.businessId = :businessId', { businessId });

    // Employees only see what they submitted themselves.
    if (actor && !isApprover(actor.role)) {
      qb.andWhere('expense.submittedById = :actorId', { actorId: actor.id });
    }
    if (query.status) {
      qb.andWhere('expense.status = :status', { status: query.status });
    }
    const boundary = (value: string) => {
      const parsed = DateTime.fromISO(value, { zone: timezone });
      return parsed.isValid ? parsed.toJSDate() : new Date(value);
    };
    if (query.from) qb.andWhere('expense.expense_date >= :from', { from: boundary(query.from) });
    if (query.to) qb.andWhere('expense.expense_date < :to', { to: boundary(query.to) });
    if (query.categoryId) {
      qb.andWhere('expense.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.search) {
      qb.andWhere('expense.description LIKE :search', {
        search: `%${query.search}%`,
      });
    }
    if (query.paymentMethod) {
      qb.andWhere('expense.payment_method = :paymentMethod', { paymentMethod: query.paymentMethod });
    }

    // Count before ordering: Postgres rejects ORDER BY on an aggregate-only query.
    const total = await qb
      .clone()
      .select('COUNT(*)', 'count')
      .getRawOne<{ count: string }>();

    const result = await qb
      .orderBy('expense.expense_date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getRawAndEntities();

    const items = result.entities.map((expense, idx) =>
      Object.assign(expense, {
        category_name:
          (result.raw[idx] as { category_name?: string }).category_name ?? null,
      }),
    );

    return { items, total: Number(total?.count ?? 0), page, limit };
  }

  async get(
    businessId: string,
    id: string,
    actor?: ExpenseActor,
  ): Promise<Expense & { category_name: string | null }> {
    // Same category join as list(), so the detail page shows the category name.
    const result = await this.repo
      .createQueryBuilder('expense')
      .leftJoin('categories', 'category', 'category.id = expense.categoryId')
      .addSelect('category.name', 'category_name')
      .where('expense.id = :id', { id })
      .andWhere('expense.businessId = :businessId', { businessId })
      .getRawAndEntities();

    const expense = result.entities[0];
    if (
      !expense ||
      (actor && !isApprover(actor.role) && expense.submittedById !== actor.id)
    ) {
      throw new NotFoundException({
        code: 'EXPENSE_NOT_FOUND',
        message: 'Expense not found.',
      });
    }
    return Object.assign(expense, {
      category_name:
        (result.raw[0] as { category_name?: string }).category_name ?? null,
    });
  }

  async create(
    businessId: string,
    dto: CreateExpenseDto,
    actor: ExpenseActor,
    timezone?: string,
  ): Promise<Expense> {
    const autoApprove = isApprover(actor.role);
    const expense = this.repo.create({
      businessId,
      description: dto.description,
      amount: Math.round(dto.amount),
      categoryId: dto.categoryId ?? null,
      payment_method: dto.paymentMethod ?? 'CASH',
      receipt_url: dto.receiptUrl ?? null,
      employeeId: dto.employeeId ?? null,
      // Today, or an earlier day picked by the person recording it (never a future day)
      expense_date: recordDateUtc(dto.expenseDate, timezone),
      status: autoApprove ? 'APPROVED' : 'PENDING',
      submittedById: actor.id,
      reviewedById: autoApprove ? actor.id : null,
      reviewed_at: autoApprove ? new Date() : null,
    });
    await this.repo.save(expense);
    await this.auditService.log({
      businessId,
      userId: actor.id,
      action: autoApprove ? 'EXPENSE_CREATED' : 'EXPENSE_SUBMITTED',
      entity: 'expense',
      entityId: expense.id,
      metadata: {
        description: expense.description,
        amount: expense.amount,
        paymentMethod: expense.payment_method,
        status: expense.status,
      },
    });
    return expense;
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateExpenseDto,
    actor: ExpenseActor,
    timezone?: string,
  ): Promise<Expense> {
    const expense = await this.get(businessId, id, actor);
    this.assertCanModify(expense, actor);
    const previous = { amount: expense.amount, description: expense.description };
    Object.assign(expense, {
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.amount !== undefined ? { amount: Math.round(dto.amount) } : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.paymentMethod !== undefined
        ? { payment_method: dto.paymentMethod }
        : {}),
      ...(dto.receiptUrl !== undefined ? { receipt_url: dto.receiptUrl || null } : {}),
      ...(dto.employeeId !== undefined ? { employeeId: dto.employeeId } : {}),
      ...(dto.expenseDate !== undefined
        ? { expense_date: recordDateUtc(dto.expenseDate, timezone) }
        : {}),
    });
    await this.repo.save(expense);
    await this.auditService.log({
      businessId,
      userId: actor.id,
      action: 'EXPENSE_UPDATED',
      entity: 'expense',
      entityId: id,
      metadata: { previous, current: { amount: expense.amount } },
    });
    return expense;
  }

  async remove(
    businessId: string,
    id: string,
    actor: ExpenseActor,
  ): Promise<void> {
    const expense = await this.get(businessId, id, actor);
    this.assertCanModify(expense, actor);
    if (actor.role === UserRole.ACCOUNTANT) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'Only an owner or manager can delete expenses.',
      });
    }
    await this.repo.remove(expense);
    await this.auditService.log({
      businessId,
      userId: actor.id,
      action: 'EXPENSE_DELETED',
      entity: 'expense',
      entityId: id,
      metadata: { amount: expense.amount },
    });
  }

  async approve(
    businessId: string,
    id: string,
    actor: ExpenseActor,
  ): Promise<Expense> {
    const expense = await this.getPending(businessId, id);
    expense.status = 'APPROVED';
    expense.reviewedById = actor.id;
    expense.reviewed_at = new Date();
    expense.rejection_reason = null;
    await this.repo.save(expense);
    await this.auditService.log({
      businessId,
      userId: actor.id,
      action: 'EXPENSE_APPROVED',
      entity: 'expense',
      entityId: id,
      metadata: { amount: expense.amount, submittedById: expense.submittedById },
    });
    return expense;
  }

  async reject(
    businessId: string,
    id: string,
    reason: string,
    actor: ExpenseActor,
  ): Promise<Expense> {
    const expense = await this.getPending(businessId, id);
    expense.status = 'REJECTED';
    expense.reviewedById = actor.id;
    expense.reviewed_at = new Date();
    expense.rejection_reason = reason.trim();
    await this.repo.save(expense);
    await this.auditService.log({
      businessId,
      userId: actor.id,
      action: 'EXPENSE_REJECTED',
      entity: 'expense',
      entityId: id,
      metadata: { amount: expense.amount, reason: expense.rejection_reason },
    });
    return expense;
  }

  async countPending(businessId: string): Promise<number> {
    return this.repo.count({ where: { businessId, status: 'PENDING' } });
  }

  /** Sum of APPROVED expenses in [from, to). */
  async totalInRange(
    businessId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const row = await this.repo
      .createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'sum')
      .where('expense.businessId = :businessId', { businessId })
      .andWhere("expense.status = 'APPROVED'")
      .andWhere('expense.expense_date >= :from', { from })
      .andWhere('expense.expense_date < :to', { to })
      .getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0);
  }

  private async getPending(businessId: string, id: string): Promise<Expense> {
    const expense = await this.get(businessId, id);
    if (expense.status !== 'PENDING') {
      throw new ConflictException({
        code: 'EXPENSE_NOT_PENDING',
        message: `This expense has already been ${expense.status.toLowerCase()}.`,
      });
    }
    return expense;
  }

  /** Employees may only change their own submissions while they are pending. */
  private assertCanModify(expense: Expense, actor: ExpenseActor): void {
    if (isApprover(actor.role)) return;
    if (expense.submittedById !== actor.id || expense.status !== 'PENDING') {
      throw new ForbiddenException({
        code: 'EXPENSE_LOCKED',
        message: 'You can only change your own expenses while they are pending.',
      });
    }
  }
}
