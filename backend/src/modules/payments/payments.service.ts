import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { accountKey } from '../customers/customers.service';

/** Where an STK push stands: "pending" until the client enters their PIN or cancels. */
export type StkState = 'pending' | 'paid' | 'cancelled' | 'failed';

interface StkRecord {
  businessId: string;
  checkoutRequestId: string;
  phone: string;
  amount: number;
  state: StkState;
  message: string;
  receipt: string | null;
  createdAt: number;
  /** Sent through the paybill owner's prompt URL; the result arrives as a paybill payment. */
  relay?: { account: string };
  /** Relay prompts: the caller has seen "paid" and records the sale itself. */
  claimed?: boolean;
  /** Relay prompts: records the payment as a plain paybill payment if no caller claims it. */
  fallback?: NodeJS.Timeout;
}

/** How long a relayed prompt's caller has to pick up the payment before it is recorded as a paybill payment. */
const CLAIM_WINDOW_MS = 10 * 60_000;

/** Result codes Safaricom returns when the client cancels or the phone doesn't answer. */
const CANCELLED_CODES = new Set(['1032', '1037', '1025', '2001']);

/**
 * M-Pesa STK push (Lipa na M-Pesa Online), two ways:
 * - Relay: MPESA_PROMPT_URL is the paybill owner's endpoint. We post
 *   {account, phone, amount}; their system sends the prompt and forwards the
 *   payment to our paybill webhook, which marks the prompt paid.
 * - Daraja: MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE and
 *   MPESA_PASSKEY (and MPESA_ENV=production when live). With MPESA_TILL set,
 *   payments go to that till (Buy Goods) instead of the paybill.
 * The relay wins when both are set.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly pushes = new Map<string, StkRecord>();
  private token: { value: string; expires: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  private env(name: string): string {
    return (this.config.get<string>(name) ?? process.env[name] ?? '').trim();
  }

  private get base(): string {
    return this.env('MPESA_ENV') === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  }

  private get relayUrl(): string {
    return this.env('MPESA_PROMPT_URL');
  }

  isConfigured(): boolean {
    return (
      !!this.relayUrl ||
      ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_SHORTCODE', 'MPESA_PASSKEY'].every((k) => !!this.env(k))
    );
  }

  status() {
    return {
      stkPush: this.isConfigured(),
      environment: this.relayUrl || this.env('MPESA_ENV') === 'production' ? 'production' : 'sandbox',
    };
  }

  /** 07XX / 01XX / +2547XX / 2547XX → 2547XXXXXXXX */
  static normalisePhone(raw: string): string | null {
    const digits = raw.replace(/\D/g, '');
    let local: string | null = null;
    if (/^0[17]\d{8}$/.test(digits)) local = digits.slice(1);
    else if (/^254[17]\d{8}$/.test(digits)) local = digits.slice(3);
    else if (/^[17]\d{8}$/.test(digits)) local = digits;
    return local ? `254${local}` : null;
  }

  private timestamp(): string {
    // Daraja wants Nairobi local time as YYYYMMDDHHmmss
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
    return `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}${get('second')}`;
  }

  private password(timestamp: string): string {
    return Buffer.from(`${this.env('MPESA_SHORTCODE')}${this.env('MPESA_PASSKEY')}${timestamp}`).toString('base64');
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expires > Date.now()) return this.token.value;
    const auth = Buffer.from(`${this.env('MPESA_CONSUMER_KEY')}:${this.env('MPESA_CONSUMER_SECRET')}`).toString('base64');
    const res = await fetch(`${this.base}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { access_token?: string; expires_in?: string } | undefined;
    if (!res?.ok || !body?.access_token) {
      this.logger.warn(`Daraja token failed: HTTP ${res?.status ?? 'network error'}`);
      throw new ServiceUnavailableException({ code: 'MPESA_AUTH_FAILED', message: 'Could not reach M-Pesa. Check the M-Pesa keys.' });
    }
    this.token = { value: body.access_token, expires: Date.now() + (Number(body.expires_in ?? 3599) - 60) * 1000 };
    return body.access_token;
  }

  async stkPush(
    businessId: string,
    input: { phone: string; amount: number; reference?: string; description?: string; account?: string | null },
  ) {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'MPESA_NOT_CONFIGURED',
        message: 'M-Pesa prompts are not set up yet. Add the Daraja keys to the server settings.',
      });
    }
    const phone = PaymentsService.normalisePhone(input.phone);
    if (!phone) throw new BadRequestException({ code: 'INVALID_PHONE', message: 'Enter a Safaricom number like 0712 345 678.' });
    const amount = Math.round(input.amount);
    if (!(amount >= 1)) throw new BadRequestException({ code: 'INVALID_AMOUNT', message: 'The amount must be at least KSh 1.' });
    if (this.relayUrl) return this.relayPush(businessId, phone, amount, (input.account || input.reference || 'Knoxville').trim());

    const till = this.env('MPESA_TILL');
    const timestamp = this.timestamp();
    const res = await fetch(`${this.base}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: this.env('MPESA_SHORTCODE'),
        Password: this.password(timestamp),
        Timestamp: timestamp,
        TransactionType: till ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phone,
        PartyB: till || this.env('MPESA_SHORTCODE'),
        PhoneNumber: phone,
        CallBackURL: this.env('MPESA_CALLBACK_URL') || 'https://example.com/api/v1/payments/mpesa/callback',
        AccountReference: (input.reference || 'Knoxville').replace(/[^A-Za-z0-9 ]/g, '').slice(0, 12) || 'Knoxville',
        TransactionDesc: (input.description || 'WiFi package').slice(0, 13),
      }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as
      | { CheckoutRequestID?: string; ResponseCode?: string; CustomerMessage?: string; errorMessage?: string }
      | undefined;
    if (!res?.ok || body?.ResponseCode !== '0' || !body.CheckoutRequestID) {
      throw new BadRequestException({
        code: 'STK_PUSH_FAILED',
        message: body?.errorMessage || body?.CustomerMessage || 'M-Pesa did not accept the request. Try again.',
      });
    }
    const record: StkRecord = {
      businessId,
      checkoutRequestId: body.CheckoutRequestID,
      phone,
      amount,
      state: 'pending',
      message: 'Waiting for the client to enter their M-Pesa PIN',
      receipt: null,
      createdAt: Date.now(),
    };
    this.pushes.set(record.checkoutRequestId, record);
    this.prune();
    return this.present(record);
  }

  /** Asks the paybill owner's system to send the prompt. */
  private async relayPush(businessId: string, phone: string, amount: number, account: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const secret = this.env('MPESA_PROMPT_SECRET');
    if (secret) headers['X-Webhook-Secret'] = secret;
    const res = await fetch(this.relayUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ account, phone, amount }),
      signal: AbortSignal.timeout(30_000),
    }).catch((err: unknown) => {
      this.logger.warn(`Prompt URL unreachable: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    });
    const text = (await res?.text().catch(() => '')) ?? '';
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* not JSON: judged by the HTTP status alone */
    }
    const data = (body.data && typeof body.data === 'object' ? body.data : {}) as Record<string, unknown>;
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const v = body[k] ?? data[k];
        if (v !== undefined && v !== null && v !== '') return String(v);
      }
      return '';
    };
    const responseCode = pick('ResponseCode', 'responseCode');
    const refused =
      !res?.ok || body.success === false || body.status === false || body.error !== undefined || (responseCode !== '' && responseCode !== '0');
    if (refused) {
      this.logger.warn(`Prompt URL refused: HTTP ${res?.status ?? 'network error'} ${text.slice(0, 300)}`);
      throw new BadRequestException({
        code: 'STK_PUSH_FAILED',
        message: pick('errorMessage', 'message', 'CustomerMessage', 'error') || 'M-Pesa did not accept the request. Try again.',
      });
    }
    this.logger.log(`Prompt sent via relay: KES ${amount} to ${phone.slice(0, 6)}***, account ${account}`);
    const record: StkRecord = {
      businessId,
      checkoutRequestId: pick('CheckoutRequestID', 'checkoutRequestId', 'checkout_request_id') || `relay-${randomUUID()}`,
      phone,
      amount,
      state: 'pending',
      message: 'Waiting for the client to enter their M-Pesa PIN',
      receipt: null,
      createdAt: Date.now(),
      relay: { account },
    };
    this.pushes.set(record.checkoutRequestId, record);
    this.prune();
    return this.present(record);
  }

  /**
   * A paybill payment just arrived: if it answers a relayed prompt still
   * waiting (same amount, and same account or phone), mark the prompt paid
   * and return the number it was sent to. Whoever sent the prompt then records the sale, as with
   * Daraja; if nobody picks it up in time, `fallback` records it as a plain
   * paybill payment instead, so the money is never lost or counted twice.
   */
  settleFromPaybill(
    payment: { account: string; phone: string | null; amount: number; transId: string },
    fallback: () => Promise<unknown>,
  ): string | null {
    const account = accountKey(payment.account);
    const last9 = payment.phone ? payment.phone.replace(/\D/g, '').slice(-9) : '';
    const cutoff = Date.now() - 30 * 60_000;
    const record = [...this.pushes.values()]
      .filter((r) => r.relay && r.state === 'pending' && r.createdAt > cutoff && r.amount === payment.amount)
      .filter((r) => (account && accountKey(r.relay!.account) === account) || (last9 && r.phone.endsWith(last9)))
      .sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!record) return null;
    this.settle(record, '0', 'Paid', payment.transId);
    record.fallback = setTimeout(() => {
      if (record.claimed) return;
      record.claimed = true;
      fallback().catch((err: unknown) =>
        this.logger.error(`M-Pesa ${payment.transId}: could not record the unclaimed prompt payment`, err instanceof Error ? err.stack : String(err)),
      );
    }, CLAIM_WINDOW_MS);
    record.fallback.unref?.();
    return record.phone;
  }

  /** Current state: from Safaricom's callback when it has arrived, else asked directly. */
  async stkStatus(businessId: string, checkoutRequestId: string) {
    const record = this.pushes.get(checkoutRequestId);
    if (!record || record.businessId !== businessId) {
      throw new NotFoundException({ code: 'STK_NOT_FOUND', message: 'That payment request was not found.' });
    }
    if (record.relay) {
      if (record.state === 'paid' && !record.claimed) {
        // The caller records the sale from here on
        record.claimed = true;
        if (record.fallback) clearTimeout(record.fallback);
      } else if (record.state === 'pending' && Date.now() - record.createdAt > 3 * 60_000) {
        record.state = 'failed';
        record.message = 'No confirmation from M-Pesa yet. If the client paid, it will still be recorded on their account automatically.';
      }
      return this.present(record);
    }
    if (record.state !== 'pending') return this.present(record);

    const answer = await this.query(checkoutRequestId);
    // While the client is still on the PIN screen Daraja answers with an error: keep waiting
    if (answer) this.settle(record, answer.code, answer.desc, null);
    if (record.state === 'pending' && Date.now() - record.createdAt > 3 * 60_000) {
      record.state = 'failed';
      record.message = 'No answer from the phone. Send the prompt again.';
    }
    return this.present(record);
  }

  /** Asks Daraja for a push's result; null while there is no answer yet or on a network hiccup. */
  private async query(checkoutRequestId: string): Promise<{ code: string; desc: string } | null> {
    const timestamp = this.timestamp();
    try {
      const res = await fetch(`${this.base}/mpesa/stkpushquery/v1/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await this.accessToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          BusinessShortCode: this.env('MPESA_SHORTCODE'),
          Password: this.password(timestamp),
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ResultCode?: string | number; ResultDesc?: string };
      return body.ResultCode === undefined ? null : { code: String(body.ResultCode), desc: body.ResultDesc ?? '' };
    } catch {
      return null;
    }
  }

  /**
   * Safaricom calls this when the client pays or cancels. The URL is public,
   * so a "paid" result is only trusted once Daraja itself confirms it.
   */
  async handleCallback(payload: unknown) {
    const cb = (payload as { Body?: { stkCallback?: unknown } } | null)?.Body?.stkCallback as
      | {
          CheckoutRequestID?: string;
          ResultCode?: number | string;
          ResultDesc?: string;
          CallbackMetadata?: { Item?: Array<{ Name: string; Value?: string | number }> };
        }
      | undefined;
    const record = cb?.CheckoutRequestID ? this.pushes.get(cb.CheckoutRequestID) : undefined;
    if (cb && record && record.state === 'pending') {
      const receipt = cb.CallbackMetadata?.Item?.find((i) => i.Name === 'MpesaReceiptNumber')?.Value;
      if (String(cb.ResultCode) === '0') {
        const confirmed = await this.query(record.checkoutRequestId);
        if (confirmed?.code === '0') this.settle(record, '0', confirmed.desc, receipt ? String(receipt) : null);
      } else {
        this.settle(record, String(cb.ResultCode), cb.ResultDesc ?? '', null);
      }
    }
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  private settle(record: StkRecord, code: string, desc: string, receipt: string | null) {
    if (code === '0') {
      record.state = 'paid';
      record.message = 'Payment received';
      record.receipt = receipt ?? record.receipt;
    } else if (CANCELLED_CODES.has(code)) {
      record.state = 'cancelled';
      record.message = code === '1037' ? 'The phone did not respond in time.' : 'The client cancelled the prompt.';
    } else {
      record.state = 'failed';
      record.message = desc || 'The payment did not go through.';
    }
  }

  private present(record: StkRecord) {
    return {
      checkoutRequestId: record.checkoutRequestId,
      phone: record.phone,
      amount: record.amount,
      state: record.state,
      message: record.message,
      receipt: record.receipt,
    };
  }

  private prune() {
    const cutoff = Date.now() - 60 * 60_000;
    for (const [id, r] of this.pushes) if (r.createdAt < cutoff) this.pushes.delete(id);
  }
}
