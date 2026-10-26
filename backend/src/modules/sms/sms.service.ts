import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../customers/entities/customer.entity';

export interface SmsResult {
  ok: boolean;
  statusCode: string;
  statusDesc: string;
  messageId: string | null;
  /** The number actually messaged, in 254… form. */
  to: string | null;
}

/** Longest message the provider accepts before it bills extra units. */
const MAX_MESSAGE_LENGTH = 900;

/**
 * Outbound SMS via the BulkSMS gateway.
 *
 * The endpoint, auth header and sender all come from the environment on
 * purpose: this gateway family has several deployments with different hosts and
 * header names, so nothing is hard-coded and no message is sent until
 * `BULKSMS_API_URL` and `BULKSMS_SENDER_ID` are both set. That keeps a
 * misconfigured key from being posted at the wrong provider.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
  ) {}

  private env(name: string): string {
    return (this.config.get<string>(name) ?? process.env[name] ?? '').trim();
  }

  /**
   * Which gateway: Mobile Sasa (SMS_PROVIDER=mobilesasa, or a mobilesasa.com
   * URL) or the default BulkSMS-style gateway (Mobitech and similar).
   */
  private get provider(): 'mobilesasa' | 'bulksms' {
    const named = this.env('SMS_PROVIDER').toLowerCase();
    if (named === 'mobilesasa') return 'mobilesasa';
    if (named) return 'bulksms';
    return /mobilesasa\.com/i.test(this.env('BULKSMS_API_URL')) ? 'mobilesasa' : 'bulksms';
  }

  private get url(): string {
    const url = this.env('BULKSMS_API_URL');
    if (this.provider === 'mobilesasa' && (!url || !/\/send\//.test(url))) {
      return 'https://api.mobilesasa.com/v1/send/message';
    }
    return url;
  }

  private get apiKey(): string {
    return this.env('BULKSMS_API_KEY');
  }

  private get senderId(): string {
    // Mobile Sasa has a shared sender for accounts without their own
    return this.env('BULKSMS_SENDER_ID') || (this.provider === 'mobilesasa' ? 'MOBILESASA' : '');
  }

  /** Header the provider expects the key in; `h_api_key` on the BulkSMS gateway. */
  private get authHeader(): string {
    return this.env('BULKSMS_AUTH_HEADER') || 'h_api_key';
  }

  /** Sending is off until every required value is present. */
  isConfigured(): boolean {
    return Boolean(this.url && this.apiKey && this.senderId);
  }

  /** Which settings are absent, so the UI can explain what to configure. */
  missingConfig(): string[] {
    return (
      [
        ['BULKSMS_API_URL', this.url],
        ['BULKSMS_API_KEY', this.apiKey],
        ['BULKSMS_SENDER_ID', this.senderId],
      ] as const
    )
      .filter(([, value]) => !value)
      .map(([name]) => name);
  }

  /**
   * Normalise to the 254XXXXXXXXX form the gateway expects.
   * Returns null when the number cannot be a Kenyan mobile.
   */
  toMsisdn(phone: string | null | undefined): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (/^254\d{9}$/.test(digits)) return digits;
    if (/^0\d{9}$/.test(digits)) return `254${digits.slice(1)}`;
    if (/^\d{9}$/.test(digits)) return `254${digits}`;
    return null;
  }

  /** Send to one client of this business, resolving their number server-side. */
  async sendToCustomer(
    businessId: string,
    customerId: string,
    message: string,
  ): Promise<SmsResult> {
    const customer = await this.customerRepo.findOne({ where: { businessId, id: customerId } });
    if (!customer) {
      throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Client not found.' });
    }
    return this.send(customer.phone, message, customer.id.slice(0, 8));
  }

  async send(phone: string | null, message: string, clientRef?: string): Promise<SmsResult> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'SMS_NOT_CONFIGURED',
        message: `SMS is not set up yet. Add ${this.missingConfig().join(', ')} to the backend .env.`,
      });
    }

    const mobile = this.toMsisdn(phone);
    if (!mobile) {
      throw new ServiceUnavailableException({
        code: 'SMS_BAD_NUMBER',
        message: phone
          ? `"${phone}" is not a valid mobile number.`
          : 'This client has no mobile number on file.',
      });
    }

    const body = message.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (this.provider === 'mobilesasa') return this.sendMobileSasa(mobile, body);

    // The gateway answers with an array of per-recipient results.
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        [this.authHeader]: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mobile,
        message: body,
        sender_name: this.senderId,
        service_id: 0,
        response_type: 'json',
        ...(clientRef ? { client_ref: clientRef } : {}),
      }),
    }).catch((err) => {
      this.logger.error(`SMS request to ${this.url} failed`, err as Error);
      return null;
    });

    if (!res) {
      throw new ServiceUnavailableException({
        code: 'SMS_UNREACHABLE',
        message: 'Could not reach the SMS provider. Check the network and try again.',
      });
    }

    const parsed = await res.json().catch(() => null);
    if (!res.ok) {
      this.logger.error(`SMS provider returned HTTP ${res.status}: ${JSON.stringify(parsed)}`);
      throw new ServiceUnavailableException({
        code: 'SMS_PROVIDER_ERROR',
        message: `The SMS provider rejected the message (HTTP ${res.status}).`,
      });
    }

    // Delivery is reported per message by status code, not by the HTTP status.
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    const statusCode = String(first?.status_code ?? '');
    const ok = statusCode === '1000';
    if (!ok) {
      this.logger.warn(`SMS not delivered to ${mobile}: ${statusCode} ${first?.status_desc ?? ''}`);
    }

    return {
      ok,
      statusCode,
      statusDesc: String(first?.status_desc ?? (ok ? 'Success' : 'Unknown')),
      messageId: first?.message_id ? String(first.message_id) : null,
      to: mobile,
    };
  }

  /**
   * Mobile Sasa: POST /v1/send/message with a Bearer API token (Settings →
   * API Tokens, scope "Send messages") and { senderID, phone, message }.
   * Success is { status: true, responseCode: "0200", messageId }.
   */
  private async sendMobileSasa(mobile: string, body: string): Promise<SmsResult> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ senderID: this.senderId, phone: mobile, message: body }),
    }).catch((err) => {
      this.logger.error(`SMS request to ${this.url} failed`, err as Error);
      return null;
    });
    if (!res) {
      throw new ServiceUnavailableException({
        code: 'SMS_UNREACHABLE',
        message: 'Could not reach the SMS provider. Check the network and try again.',
      });
    }
    const parsed = (await res.json().catch(() => null)) as
      | { status?: boolean; responseCode?: string | number; message?: string; messageId?: string | number }
      | null;
    const statusCode = String(parsed?.responseCode ?? res.status);
    const ok = res.ok && (parsed?.status === true || statusCode === '0200');
    if (!ok) {
      this.logger.warn(`Mobile Sasa did not accept the SMS to ${mobile}: HTTP ${res.status} ${JSON.stringify(parsed)}`);
      if (res.status === 401 || res.status === 403) {
        throw new ServiceUnavailableException({
          code: 'SMS_PROVIDER_ERROR',
          message: `Mobile Sasa rejected the API token (HTTP ${res.status}). Check BULKSMS_API_KEY.`,
        });
      }
    }
    return {
      ok,
      statusCode,
      statusDesc: String(parsed?.message ?? (ok ? 'Accepted' : `HTTP ${res.status}`)),
      messageId: parsed?.messageId != null ? String(parsed.messageId) : null,
      to: mobile,
    };
  }
}
