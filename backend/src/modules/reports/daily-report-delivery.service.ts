import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DateTime } from 'luxon';
import * as nodemailer from 'nodemailer';
import { LessThan, Repository } from 'typeorm';
import { Business } from '../businesses/entities/business.entity';
import { User } from '../users/entities/user.entity';
import { formatMoney } from '../../common/utils/money';
import { DailyReportService } from './daily-report.service';
import { DailyReportDelivery } from './entities/daily-report-delivery.entity';
import { DailyReportSettings } from './entities/daily-report-settings.entity';
import { ReportExportService } from './report-export.service';

const DEFAULT_TZ = 'Africa/Nairobi';
const SEND_AFTER_LOCAL_HOUR = 6;

@Injectable()
export class DailyReportDeliveryService {
  private readonly logger = new Logger(DailyReportDeliveryService.name);

  constructor(
    @InjectRepository(Business) private readonly businessRepo: Repository<Business>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(DailyReportDelivery)
    private readonly deliveryRepo: Repository<DailyReportDelivery>,
    @InjectRepository(DailyReportSettings)
    private readonly settingsRepo: Repository<DailyReportSettings>,
    private readonly dailyReports: DailyReportService,
    private readonly exports: ReportExportService,
    private readonly config: ConfigService,
  ) {}

  async settings(businessId: string) {
    const business = await this.business(businessId);
    const preferences = await this.settingsRepo.findOne({ where: { businessId } });
    const recipient = await this.recipient(business, preferences);
    const last = await this.deliveryRepo.findOne({
      where: { businessId },
      order: { report_date: 'DESC' },
    });
    return {
      enabled: preferences?.enabled ?? true,
      email: recipient,
      usingOwnerEmail: !preferences?.email,
      emailConfigured: Boolean(this.config.get<string>('SMTP_HOST')),
      sendTime: '06:00',
      timezone: business.timezone || DEFAULT_TZ,
      lastDelivery: last
        ? { date: last.report_date, status: last.status, sentAt: last.sent_at }
        : null,
    };
  }

  async updateSettings(
    businessId: string,
    update: { email?: string | null; enabled?: boolean },
  ) {
    const business = await this.business(businessId);
    const preferences = await this.settingsRepo.findOne({ where: { businessId } })
      ?? this.settingsRepo.create({ businessId, enabled: true, email: null });
    if (update.email !== undefined) preferences.email = update.email?.trim().toLowerCase() || null;
    if (update.enabled !== undefined) preferences.enabled = update.enabled;
    const recipient = await this.recipient(business, preferences);
    if (preferences.enabled && !recipient) {
      throw new BadRequestException({
        code: 'REPORT_EMAIL_REQUIRED',
        message: 'Add a report email address or add an email to the business owner account before enabling daily reports.',
      });
    }
    await this.settingsRepo.save(preferences);
    return this.settings(businessId);
  }

  /** Check every ten minutes so businesses in different timezones get a local morning delivery. */
  @Cron('*/10 * * * *')
  async deliverDueReports(): Promise<void> {
    if (!this.config.get<string>('SMTP_HOST')) return;
    const [businesses, preferences] = await Promise.all([
      this.businessRepo.find({ where: { status: 'ACTIVE' } }),
      this.settingsRepo.find(),
    ]);
    const preferenceByBusiness = new Map(preferences.map((preference) => [preference.businessId, preference]));
    for (const business of businesses) {
      const preference = preferenceByBusiness.get(business.id);
      if (preference?.enabled === false) continue;
      const timezone = business.timezone || DEFAULT_TZ;
      const now = DateTime.now().setZone(timezone);
      // A missed run (e.g. a sleeping API process) catches up with yesterday's closed report.
      if (!now.isValid || now.hour < SEND_AFTER_LOCAL_HOUR) continue;
      try {
        if (!(await this.recipient(business, preference))) continue;
        await this.deliver(business, now.minus({ days: 1 }).toISODate()!);
      } catch (error) {
        this.logger.error(
          `Daily report delivery failed for business ${business.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  private async deliver(business: Business, date: string): Promise<{ sent: boolean; date: string; email: string }> {
    const email = await this.recipient(business);
    if (!email) {
      throw new BadRequestException({
        code: 'REPORT_EMAIL_REQUIRED',
        message: 'Set a report email address or add an email to the business owner account.',
      });
    }
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      throw new ServiceUnavailableException({
        code: 'EMAIL_NOT_CONFIGURED',
        message: 'Daily email delivery is not configured on the server. Set SMTP_HOST and the SMTP credentials.',
      });
    }
    if (!DateTime.fromISO(date, { zone: business.timezone || DEFAULT_TZ }).isValid) {
      throw new BadRequestException({ code: 'INVALID_REPORT_DATE', message: 'Choose a valid report date.' });
    }

    const claimed = await this.claim(business, date, email);
    if (!claimed) return { sent: false, date, email };

    try {
      const context = {
        businessId: business.id,
        businessName: business.name,
        timezone: business.timezone || DEFAULT_TZ,
        currency: business.currency || 'KES',
      };
      const report = await this.dailyReports.report(business.id, date, context.timezone);
      const [pdf, xlsx] = await Promise.all([
        this.exports.dailyPdf(context, date, report),
        this.exports.dailyXlsx(context, date, report),
      ]);
      const summary = [
        `Revenue: ${formatMoney(report.revenue.total, context.currency)} (${report.revenue.salesCount} sales)`,
        `Collected: ${formatMoney(report.revenue.collected, context.currency)}`,
        `Approved expenses: ${formatMoney(report.expenses.total, context.currency)}`,
        `Net profit: ${formatMoney(report.profit.net, context.currency)}`,
        `Cash movement: ${formatMoney(report.cash.net, context.currency)}`,
      ];
      const htmlEntities: Record<string, string> = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      };
      const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => htmlEntities[char] ?? char);
      const transport = nodemailer.createTransport({
        host,
        port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: this.config.get<string>('SMTP_USER')
          ? { user: this.config.get<string>('SMTP_USER'), pass: this.config.get<string>('SMTP_PASS') }
          : undefined,
      });
      await transport.sendMail({
        from: this.config.get<string>('SMTP_FROM') ?? `${business.name} <no-reply@knoxville.co.ke>`,
        to: email,
        subject: `Daily business report · ${report.date} · ${business.name}`,
        text: [
          `Daily business report for ${business.name} · ${report.date}`,
          '',
          ...summary,
          '',
          'The full report is attached in PDF and Excel formats.',
        ].join('\n'),
        html: `<div style="font-family:Arial,sans-serif;color:#17212b;max-width:640px;margin:auto"><div style="background:#102b24;color:#fff;padding:24px;border-radius:12px 12px 0 0"><div style="font-size:12px;letter-spacing:2px;color:#a9e06d">KNOXVILLE · DAILY CLOSE</div><h1 style="font-size:22px;margin:12px 0 4px">${escapeHtml(business.name)}</h1><div style="color:#d1d8d5">${escapeHtml(report.date ?? '')}</div></div><div style="padding:22px;border:1px solid #e5e9e7;border-top:0;border-radius:0 0 12px 12px"><p style="margin-top:0">Your previous day's report is ready. The clean PDF and detailed Excel workbook are attached.</p><table style="border-collapse:collapse;width:100%">${summary.map((line) => { const [label, value] = line.split(': '); return `<tr><td style="padding:10px 8px;border-bottom:1px solid #edf0ee;color:#57645e">${escapeHtml(label ?? '')}</td><td style="padding:10px 8px;border-bottom:1px solid #edf0ee;text-align:right;font-weight:bold">${escapeHtml(value ?? '')}</td></tr>`; }).join('')}</table><p style="font-size:12px;color:#758078;margin-bottom:0">Sent automatically by Knoxville.</p></div></div>`,
        attachments: [
          { filename: pdf.filename, content: pdf.buffer, contentType: pdf.contentType },
          { filename: xlsx.filename, content: xlsx.buffer, contentType: xlsx.contentType },
        ],
      });
      await this.deliveryRepo.update(
        { businessId: business.id, report_date: date },
        { status: 'SENT', sent_at: new Date(), last_error: null },
      );
      return { sent: true, date, email };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.deliveryRepo.update(
        { businessId: business.id, report_date: date },
        { status: 'FAILED', last_error: message.slice(0, 4000) },
      );
      throw error;
    }
  }

  private async claim(business: Business, date: string, email: string): Promise<boolean> {
    let delivery = await this.deliveryRepo.findOne({ where: { businessId: business.id, report_date: date } });
    if (!delivery) {
      try {
        await this.deliveryRepo.save(this.deliveryRepo.create({
          businessId: business.id,
          report_date: date,
          status: 'SENDING',
          recipient: email,
          sent_at: null,
          last_error: null,
        }));
        return true;
      } catch {
        // Another API instance may have inserted the unique business/date row first.
        delivery = await this.deliveryRepo.findOne({ where: { businessId: business.id, report_date: date } });
        if (!delivery) throw new Error('Could not reserve the daily report delivery.');
      }
    }
    if (delivery.status === 'SENT') return false;
    const staleBefore = new Date(Date.now() - 30 * 60_000);
    const criteria = delivery.status === 'SENDING'
      ? { id: delivery.id, status: 'SENDING' as const, updated_at: LessThan(staleBefore) }
      : { id: delivery.id, status: 'FAILED' as const };
    const claimed = await this.deliveryRepo.update(criteria, {
      status: 'SENDING', recipient: email, sent_at: null, last_error: null,
    });
    return (claimed.affected ?? 0) > 0;
  }

  private async business(id: string): Promise<Business> {
    const business = await this.businessRepo.findOne({ where: { id } });
    if (!business) throw new BadRequestException({ code: 'BUSINESS_NOT_FOUND', message: 'Business not found.' });
    return business;
  }

  private async recipient(business: Business, preferences?: DailyReportSettings | null): Promise<string> {
    if (preferences?.email) return preferences.email;
    if (!business.ownerId) return '';
    const owner = await this.userRepo.findOne({ where: { id: business.ownerId } });
    return owner?.email ?? '';
  }
}
