import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { SmsService } from './sms.service';

export interface WhatsappResult {
  ok: boolean;
  messageId: string | null;
  statusDesc: string;
  to: string;
}

/**
 * WhatsApp through Meta's WhatsApp Cloud API (WhatsApp Business Platform).
 *
 * Settings: WHATSAPP_TOKEN (permanent system-user token) and
 * WHATSAPP_PHONE_NUMBER_ID. WhatsApp only lets a business start a chat with
 * an approved template, so set WHATSAPP_TEMPLATE (e.g. payment_reminder) and,
 * if not English, WHATSAPP_TEMPLATE_LANG. Without a template only free text is
 * sent, which WhatsApp accepts only within 24 hours of the client's last message.
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly sms: SmsService,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
  ) {}

  private env(name: string): string {
    return (this.config.get<string>(name) ?? process.env[name] ?? '').trim();
  }

  isConfigured(): boolean {
    return Boolean(this.env('WHATSAPP_TOKEN') && this.env('WHATSAPP_PHONE_NUMBER_ID'));
  }

  /** Template variables in order: {{1}} first name, {{2}} amount due, {{3}} account number. */
  async sendToCustomer(businessId: string, customerId: string, message: string, params: string[] = []): Promise<WhatsappResult> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'WHATSAPP_NOT_CONFIGURED',
        message: 'WhatsApp sending is not set up on the server yet. Use "Open WhatsApp" instead.',
      });
    }
    const customer = await this.customerRepo.findOne({ where: { businessId, id: customerId } });
    if (!customer) throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Client not found.' });
    const to = this.sms.toMsisdn(customer.phone);
    if (!to) {
      throw new ServiceUnavailableException({
        code: 'WHATSAPP_BAD_NUMBER',
        message: customer.phone ? `"${customer.phone}" is not a valid mobile number.` : 'This client has no mobile number on file.',
      });
    }

    const template = this.env('WHATSAPP_TEMPLATE');
    const payload = template
      ? {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: template,
            language: { code: this.env('WHATSAPP_TEMPLATE_LANG') || 'en' },
            ...(params.length
              ? { components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: String(text).slice(0, 200) })) }] }
              : {}),
          },
        }
      : { messaging_product: 'whatsapp', to, type: 'text', text: { body: message.trim().slice(0, 4000) } };

    const version = this.env('WHATSAPP_API_VERSION') || 'v21.0';
    const base = this.env('WHATSAPP_API_BASE') || 'https://graph.facebook.com';
    const url = `${base}/${version}/${this.env('WHATSAPP_PHONE_NUMBER_ID')}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.env('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((err) => {
      this.logger.error('WhatsApp request failed', err as Error);
      return null;
    });
    if (!res) {
      throw new ServiceUnavailableException({ code: 'WHATSAPP_UNREACHABLE', message: 'Could not reach WhatsApp. Try again.' });
    }
    const body = (await res.json().catch(() => null)) as
      | { messages?: Array<{ id?: string }>; error?: { message?: string; code?: number } }
      | null;
    if (!res.ok || body?.error) {
      const reason = body?.error?.message ?? `HTTP ${res.status}`;
      this.logger.warn(`WhatsApp did not accept the message to ${to}: ${reason}`);
      throw new ServiceUnavailableException({ code: 'WHATSAPP_PROVIDER_ERROR', message: `WhatsApp rejected the message: ${reason}` });
    }
    return { ok: true, messageId: body?.messages?.[0]?.id ?? null, statusDesc: 'Sent', to };
  }
}
