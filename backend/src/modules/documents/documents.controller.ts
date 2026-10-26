import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../../common/guards/business.guard';
import { CurrentBusiness } from '../../common/decorators/current-user.decorator';
import { DocFormat, DocKind, DocumentsService } from './documents.service';

class EmailDocumentDto {
  @IsIn(['invoice', 'receipt'])
  kind: DocKind;

  @IsEmail({}, { message: 'Enter a valid email address.' })
  to: string;
}

class EmailReminderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  saleIds: string[];

  @IsString()
  @MinLength(1, { message: 'Write a message first.' })
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  subject?: string;
}

class ShareDocumentDto {
  @IsIn(['invoice', 'receipt'])
  kind: DocKind;
}

function sendPdf(res: Response, file: { buffer: Buffer; filename: string }, download: boolean) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${file.filename}"`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.send(file.buffer);
}

const kindOf = (k?: string): DocKind => (k === 'receipt' ? 'receipt' : 'invoice');
const formatOf = (f?: string): DocFormat => (f === 'thermal' ? 'thermal' : 'a4');

@ApiTags('documents')
@Controller('sales/:saleId/documents')
@UseGuards(JwtAuthGuard, BusinessGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get(':kind.pdf')
  @ApiOperation({ summary: 'Invoice or receipt PDF (A4, or 80mm thermal with format=thermal)' })
  @ApiQuery({ name: 'format', required: false, enum: ['a4', 'thermal'] })
  @ApiQuery({ name: 'paymentId', required: false })
  async pdf(
    @CurrentBusiness() business: { id: string },
    @Param('saleId', ParseUUIDPipe) saleId: string,
    @Param('kind') kind: string,
    @Query('format') format: string | undefined,
    @Query('paymentId') paymentId: string | undefined,
    @Res() res: Response,
  ) {
    sendPdf(res, await this.documents.render(business.id, saleId, kindOf(kind), formatOf(format), paymentId), true);
  }

  @Post('share')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link + message for sharing by WhatsApp (works without signing in)' })
  async share(
    @CurrentBusiness() business: { id: string },
    @Param('saleId', ParseUUIDPipe) saleId: string,
    @Body() dto: ShareDocumentDto,
  ) {
    const summary = await this.documents.summary(business.id, saleId, dto.kind);
    return { token: this.documents.shareToken(business.id, saleId), ...summary };
  }

  @Post('email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Email the invoice or receipt PDF to the client' })
  email(
    @CurrentBusiness() business: { id: string },
    @Param('saleId', ParseUUIDPipe) saleId: string,
    @Body() dto: EmailDocumentDto,
  ) {
    return this.documents.email(business.id, saleId, dto.kind, dto.to);
  }
}

/** Payment reminders by email, with the client's unpaid invoices attached. */
@ApiTags('documents')
@Controller('customers/:customerId')
@UseGuards(JwtAuthGuard, BusinessGuard)
@ApiBearerAuth()
export class CustomerEmailController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('email-reminder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Email the client a payment reminder with their invoice PDFs attached' })
  emailReminder(
    @CurrentBusiness() business: { id: string },
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: EmailReminderDto,
  ) {
    return this.documents.emailReminder(business.id, customerId, dto.saleIds, dto.message, dto.subject);
  }
}

/** Public, token-protected link clients open from WhatsApp; no sign-in needed. */
@ApiTags('documents')
@Controller('public/documents')
export class PublicDocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get(':token/:kind.pdf')
  @ApiOperation({ summary: 'Shared invoice/receipt PDF opened from a link' })
  async open(
    @Param('token') token: string,
    @Param('kind') kind: string,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const { businessId, saleId } = this.documents.readShareToken(token);
    sendPdf(res, await this.documents.render(businessId, saleId, kindOf(kind), formatOf(format)), false);
  }
}
