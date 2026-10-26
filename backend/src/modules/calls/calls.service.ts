import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, MoreThan, Not, Repository } from 'typeorm';
import { CallLog } from './entities/call-log.entity';
import { CreateCallLogDto } from './calls.dto';
import { Customer } from '../customers/entities/customer.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { subscriptionStatus } from '../subscriptions/subscriptions.service';
import { todayRangeUtc } from '../../common/utils/dates';

const DAY = 86_400_000;

type Reason = 'FOLLOW_UP' | 'EXPIRING' | 'EXPIRED' | 'BALANCE';

@Injectable()
export class CallsService {
  constructor(
    @InjectRepository(CallLog) private readonly repo: Repository<CallLog>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async log(businessId: string, customerId: string, userId: string, dto: CreateCallLogDto) {
    await this.requireCustomer(businessId, customerId);
    // Logging a new call closes any earlier call-back still open for this client
    await this.repo.update(
      { businessId, customerId, follow_up_done: false, follow_up_at: Not(IsNull()) },
      { follow_up_done: true },
    );
    const saved = await this.repo.save(
      this.repo.create({
        businessId,
        customerId,
        userId,
        channel: dto.channel ?? 'PHONE',
        outcome: dto.outcome,
        notes: dto.notes?.trim() || null,
        follow_up_at: dto.followUpAt ? new Date(dto.followUpAt) : null,
        follow_up_done: false,
      }),
    );
    return (await this.present([saved]))[0];
  }

  async history(businessId: string, customerId: string) {
    await this.requireCustomer(businessId, customerId);
    const logs = await this.repo.find({
      where: { businessId, customerId },
      order: { created_at: 'DESC' },
      take: 50,
    });
    return this.present(logs);
  }

  async completeFollowUp(businessId: string, id: string) {
    const log = await this.repo.findOne({ where: { businessId, id } });
    if (!log) throw new NotFoundException({ code: 'CALL_NOT_FOUND', message: 'Call not found.' });
    log.follow_up_done = true;
    await this.repo.save(log);
    return { success: true };
  }

  /**
   * Who to call today: scheduled call-backs that are due, plus clients whose
   * package expires within 3 days or lapsed in the last week, and clients who
   * owe money, unless someone already spoke to them in the last 2 days.
   */
  async due(businessId: string) {
    const now = Date.now();
    const { end: endOfToday } = todayRangeUtc();

    const followUps = await this.repo.find({
      where: { businessId, follow_up_done: false, follow_up_at: LessThan(endOfToday) },
      order: { follow_up_at: 'ASC' },
    });
    const [subs, debtors, recent] = await Promise.all([
      this.subRepo
        .createQueryBuilder('s')
        .where('s.businessId = :businessId', { businessId })
        .andWhere('s.expires_at < :soon AND s.expires_at > :lapsed', {
          soon: new Date(now + 3 * DAY),
          lapsed: new Date(now - 7 * DAY),
        })
        .orderBy('s.expires_at', 'ASC')
        .getMany(),
      this.customerRepo.find({
        where: { businessId, outstanding_balance: MoreThan(0) },
        order: { outstanding_balance: 'DESC' },
        take: 20,
      }),
      this.repo.find({
        where: { businessId, created_at: MoreThan(new Date(now - 2 * DAY)) },
        select: ['customerId'],
      }),
    ]);

    const recentlyCalled = new Set(recent.map((r) => r.customerId));
    const items = new Map<string, { customerId: string; reasons: Reason[]; followUp: CallLog | null; sub: Subscription | null }>();
    const add = (customerId: string, reason: Reason, extra: Partial<{ followUp: CallLog; sub: Subscription }> = {}) => {
      const item = items.get(customerId) ?? { customerId, reasons: [], followUp: null, sub: null };
      if (!item.reasons.includes(reason)) item.reasons.push(reason);
      if (extra.followUp) item.followUp = extra.followUp;
      if (extra.sub) item.sub = extra.sub;
      items.set(customerId, item);
    };

    for (const f of followUps) add(f.customerId, 'FOLLOW_UP', { followUp: f });
    for (const s of subs) {
      if (recentlyCalled.has(s.customerId) && !items.has(s.customerId)) continue;
      add(s.customerId, subscriptionStatus(s.expires_at, now) === 'EXPIRED' ? 'EXPIRED' : 'EXPIRING', { sub: s });
    }
    for (const d of debtors) {
      if (recentlyCalled.has(d.id) && !items.has(d.id)) continue;
      add(d.id, 'BALANCE');
    }

    const ids = [...items.keys()];
    const customers = ids.length ? await this.customerRepo.find({ where: { businessId, id: In(ids) } }) : [];
    const byId = new Map(customers.map((c) => [c.id, c]));

    return [...items.values()]
      .filter((i) => byId.has(i.customerId))
      .map((i) => {
        const c = byId.get(i.customerId)!;
        return {
          customer: { id: c.id, name: c.name, phone: c.phone, outstandingBalance: c.outstanding_balance },
          reasons: i.reasons,
          followUp: i.followUp
            ? { id: i.followUp.id, at: i.followUp.follow_up_at, notes: i.followUp.notes, outcome: i.followUp.outcome }
            : null,
          subscription: i.sub
            ? { packageName: i.sub.package_name, expiresAt: i.sub.expires_at, status: subscriptionStatus(i.sub.expires_at, now) }
            : null,
        };
      })
      // Scheduled call-backs first, then lapsed, expiring, money owed
      .sort((a, b) => rank(a.reasons) - rank(b.reasons));
  }

  async dueCount(businessId: string) {
    return (await this.due(businessId)).length;
  }

  private async requireCustomer(businessId: string, customerId: string) {
    const exists = await this.customerRepo.exist({ where: { businessId, id: customerId } });
    if (!exists) throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Client not found.' });
  }

  private async present(logs: CallLog[]) {
    const userIds = [...new Set(logs.map((l) => l.userId))];
    const users = userIds.length ? await this.userRepo.find({ where: { id: In(userIds) } }) : [];
    const names = new Map(users.map((u) => [u.id, u.full_name]));
    return logs.map((l) => ({
      id: l.id,
      customerId: l.customerId,
      channel: l.channel,
      outcome: l.outcome,
      notes: l.notes,
      followUpAt: l.follow_up_at,
      followUpDone: l.follow_up_done,
      calledAt: l.created_at,
      calledBy: names.get(l.userId) ?? 'Staff',
    }));
  }
}

function rank(reasons: Reason[]): number {
  if (reasons.includes('FOLLOW_UP')) return 0;
  if (reasons.includes('EXPIRED')) return 1;
  if (reasons.includes('EXPIRING')) return 2;
  return 3;
}
