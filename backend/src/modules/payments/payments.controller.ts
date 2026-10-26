import { SkipThrottle } from '@nestjs/throttler';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../../common/guards/business.guard';
import { CurrentBusiness } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';

class StkPushDto {
  @ApiProperty({ example: '0712345678' })
  @IsString()
  @MaxLength(20)
  phone: string;

  @ApiProperty({ example: 1999 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: 'Home 15' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  description?: string;
}

@ApiTags('payments')
@Controller('payments/mpesa')
@UseGuards(JwtAuthGuard, BusinessGuard)
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('status')
  @ApiOperation({ summary: 'Whether M-Pesa STK push is set up' })
  status() {
    return this.payments.status();
  }

  @Post('stk-push')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send an M-Pesa payment prompt to the phone of the client' })
  stkPush(@CurrentBusiness() business: { id: string }, @Body() dto: StkPushDto) {
    return this.payments.stkPush(business.id, dto);
  }

  @Get('stk-push/:checkoutRequestId')
  @ApiOperation({ summary: 'Check whether the client has paid' })
  stkStatus(@CurrentBusiness() business: { id: string }, @Param('checkoutRequestId') id: string) {
    return this.payments.stkStatus(business.id, id);
  }
}

/** Safaricom posts results here (public, no sign-in). Point MPESA_CALLBACK_URL at it. */
@ApiTags('payments')
@Controller('payments/mpesa')
@SkipThrottle()
export class MpesaCallbackController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Daraja STK callback' })
  callback(@Body() body: unknown) {
    return this.payments.handleCallback(body);
  }
}
