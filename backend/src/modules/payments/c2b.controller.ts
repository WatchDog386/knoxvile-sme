import { SkipThrottle } from '@nestjs/throttler';
import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../../common/guards/business.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentBusiness } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/types/auth-user.interface';
import { C2bService, type C2bPayload } from './c2b.service';

/**
 * Paybill payments forwarded by the company's existing M-Pesa integration.
 * Public (no sign-in) but every call must carry the shared secret.
 */
@ApiTags('payments')
@Controller('payments/mpesa')
@SkipThrottle()
export class MpesaC2bWebhookController {
  constructor(private readonly c2b: C2bService) {}

  @Post('c2b')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paybill payment (Safaricom C2B confirmation fields), forwarded with X-Webhook-Secret' })
  @ApiHeader({ name: 'X-Webhook-Secret', required: true })
  async receive(
    @Headers('x-webhook-secret') header: string | undefined,
    @Query('secret') query: string | undefined,
    @Body() body: C2bPayload,
    @Res() res: Response,
  ) {
    this.c2b.assertSecret(header ?? query);
    // Plain M-Pesa style reply ({"ResultCode":0,"ResultDesc":"Accepted"}), not the app's usual wrapper
    res.status(HttpStatus.OK).json(await this.c2b.receive(body ?? {}));
  }
}

/** The office's list of paybill payments received. */
@ApiTags('payments')
@Controller('payments/mpesa')
@UseGuards(JwtAuthGuard, BusinessGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
@ApiBearerAuth()
export class MpesaC2bListController {
  constructor(private readonly c2b: C2bService) {}

  @Get('c2b')
  @ApiOperation({ summary: 'Latest paybill payments received through the webhook' })
  list(@CurrentBusiness() business: { id: string }, @Query('limit') limit?: string) {
    return this.c2b.list(business.id, Number(limit) || 100);
  }
}
