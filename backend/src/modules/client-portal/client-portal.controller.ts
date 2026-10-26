import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { IsEmail, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../../common/guards/business.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClientAccess } from '../../common/decorators/client-access.decorator';
import { CurrentBusiness, CurrentMembership, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, UserRole } from '../../common/types/auth-user.interface';
import { ClientPortalService } from './client-portal.service';

class ClientPayDto {
  @IsOptional()
  @IsUUID()
  saleId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  /** Amount to prompt for, capped by the selected package price or invoice balance. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;
}

class GrantAccessDto {
  /** Optional: without it the client signs in with their account number. */
  @IsOptional()
  @ValidateIf((_, v) => v !== '')
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email?: string;

  /** Optional: leave it out and the server generates a readable temporary one. */
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'The password must be at least 8 characters.' })
  password?: string;
}

type Membership = { role: UserRole; customerId?: string | null };

function clientOf(m: Membership): string {
  if (m.role !== UserRole.CLIENT || !m.customerId) {
    throw new ForbiddenException({ code: 'CLIENTS_ONLY', message: 'This is the client app.' });
  }
  return m.customerId;
}

/** The client app: only the signed-in client's own data. */
@ApiTags('client')
@Controller('client')
@UseGuards(JwtAuthGuard, BusinessGuard)
@ClientAccess()
@ApiBearerAuth()
export class ClientPortalController {
  constructor(private readonly portal: ClientPortalService) {}

  @Get('me')
  @ApiOperation({ summary: "The client's package, balance, packages to switch to and payments" })
  me(@CurrentBusiness() business: { id: string }, @CurrentMembership() m: Membership) {
    return this.portal.me(business.id, clientOf(m));
  }

  @Post('pay')
  @ApiOperation({ summary: "M-Pesa prompt to the client's phone to pay for or renew a package" })
  pay(
    @CurrentBusiness() business: { id: string },
    @CurrentMembership() m: Membership,
    @CurrentUser() user: AuthUser,
    @Body() dto: ClientPayDto,
  ) {
    return this.portal.pay(business.id, clientOf(m), user.id, dto);
  }

  @Get('pay/:checkoutRequestId')
  @ApiOperation({ summary: 'Whether the client has paid; records the renewal once paid' })
  payStatus(
    @CurrentBusiness() business: { id: string },
    @CurrentMembership() m: Membership,
    @Param('checkoutRequestId') id: string,
  ) {
    return this.portal.payStatus(business.id, clientOf(m), id);
  }

  @Get('sales/:saleId/:kind.pdf')
  @ApiOperation({ summary: "The client's own invoice or receipt" })
  async document(
    @CurrentBusiness() business: { id: string },
    @CurrentMembership() m: Membership,
    @Param('saleId', ParseUUIDPipe) saleId: string,
    @Param('kind') kind: string,
    @Res() res: Response,
  ) {
    const file = await this.portal.document(business.id, clientOf(m), saleId, kind === 'receipt' ? 'receipt' : 'invoice');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(file.buffer);
  }
}

/** Staff (admin, manager, accountant) give a client their app login. */
@ApiTags('customers')
@Controller('customers/:customerId/app-access')
@UseGuards(JwtAuthGuard, BusinessGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
@ApiBearerAuth()
export class ClientAccessController {
  constructor(private readonly portal: ClientPortalService) {}

  @Get()
  @ApiOperation({ summary: "Whether the client has an app login" })
  get(@CurrentBusiness() business: { id: string }, @Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.portal.getAccess(business.id, customerId);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create or reset the client app login; the generated temporary password is returned once',
  })
  grant(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: GrantAccessDto,
  ) {
    return this.portal.grantAccess(business.id, customerId, dto, user.id);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Turn off the client app login' })
  revoke(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.portal.revokeAccess(business.id, customerId, user.id);
  }
}
