import { SkipThrottle } from '@nestjs/throttler';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/** Signatures older than this are refused, so a captured request cannot be replayed. */
const MAX_AGE_SECONDS = 300;

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Callbacks from Mobile Sasa (delivery reports, replies to our SMS, USSD).
 * Each one is checked against MOBILESASA_WEBHOOK_SECRET (the whsec_ value in
 * Mobile Sasa → Settings → Webhooks): the X-MobileSasa-Signature header
 * (t=<unix>,v1=HMAC-SHA256(secret, t + "." + raw body)) when present,
 * otherwise the X-MobileSasa-Secret header.
 */
@ApiTags('sms')
@Controller('sms/mobilesasa')
@SkipThrottle()
export class MobileSasaWebhookController {
  private readonly logger = new Logger('MobileSasaWebhook');

  constructor(private readonly config: ConfigService) {}

  private secret(): string {
    return (this.config.get<string>('MOBILESASA_WEBHOOK_SECRET') ?? process.env.MOBILESASA_WEBHOOK_SECRET ?? '').trim();
  }

  private verify(req: Request, signature: string | undefined, plain: string | undefined) {
    const secret = this.secret();
    if (!secret) {
      throw new ServiceUnavailableException({ code: 'WEBHOOK_NOT_CONFIGURED', message: 'The Mobile Sasa webhook is not set up yet.' });
    }
    if (signature) {
      const parts = Object.fromEntries(
        signature.split(',').map((p) => {
          const i = p.indexOf('=');
          return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
        }),
      );
      const t = Number(parts.t);
      const raw = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
      if (parts.v1 && Number.isFinite(t) && Math.abs(Date.now() / 1000 - t) <= MAX_AGE_SECONDS) {
        const mac = createHmac('sha256', secret).update(`${parts.t}.`).update(raw);
        const digest = mac.digest();
        if (safeEqual(parts.v1, digest.toString('hex')) || safeEqual(parts.v1, digest.toString('base64'))) return;
      }
      throw new UnauthorizedException({ code: 'BAD_WEBHOOK_SIGNATURE', message: 'Invalid or expired signature.' });
    }
    if (plain && safeEqual(plain, secret)) return;
    throw new UnauthorizedException({ code: 'BAD_WEBHOOK_SECRET', message: 'Wrong webhook secret.' });
  }

  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mobile Sasa callbacks: delivery reports, incoming SMS, USSD (signed)' })
  callback(
    @Req() req: Request,
    @Headers('x-mobilesasa-signature') signature: string | undefined,
    @Headers('x-mobilesasa-secret') plain: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    this.verify(req, signature, plain);
    // Delivery reports name the message and its status; anything else is logged as-is
    const id = body?.messageId ?? body?.message_id ?? body?.id;
    const status = body?.status ?? body?.deliveryStatus ?? body?.dlrStatus;
    const phone = body?.phone ?? body?.msisdn ?? body?.from;
    if (id || status) {
      this.logger.log(`Delivery report: message ${String(id ?? '?')} to ${String(phone ?? '?')} → ${String(status ?? '?')}`);
    } else {
      this.logger.log(`Callback: ${JSON.stringify(body).slice(0, 500)}`);
    }
    return { received: true };
  }
}
