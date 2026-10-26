import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../../common/guards/business.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentBusiness,
  CurrentMembership,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { AuthUser, UserRole } from '../../common/types/auth-user.interface';
import { CreateSaleDto, RecordPaymentDto } from './dto/sale.dto';
import { SalesListQueryDto } from './dto/sales-list-query.dto';

@ApiTags('sales')
@Controller('sales')
@UseGuards(JwtAuthGuard, BusinessGuard)
@ApiBearerAuth()
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @ApiOperation({ summary: 'List sales' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'paymentStatus', required: false })
  @ApiQuery({ name: 'paymentMethod', required: false })
  @ApiQuery({ name: 'saleType', required: false })
  @ApiQuery({ name: 'search', required: false })
  list(
    @CurrentBusiness() business: { id: string; timezone: string },
    @Query() query: SalesListQueryDto,
  ) {
    return this.salesService.list(business.id, query, business.timezone);
  }

  @Post('preview')
  @ApiOperation({ summary: 'Preview sale totals without saving' })
  preview(
    @CurrentBusiness() business: { id: string },
    @Body() dto: CreateSaleDto,
  ) {
    return this.salesService.preview(business.id, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Record a sale' })
  create(
    @CurrentBusiness() business: { id: string; timezone: string },
    @CurrentUser() user: AuthUser,
    @CurrentMembership() membership: { role: UserRole },
    @Body() dto: CreateSaleDto,
  ) {
    return this.salesService.create(
      business.id,
      dto,
      { userId: user.id, role: membership.role },
      business.timezone,
    );
  }

  @Get('customer/:customerId/advances')
  @ApiOperation({ summary: 'Available advance credit for a client' })
  availableAdvances(
    @CurrentBusiness() business: { id: string },
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.salesService.availableAdvances(business.id, customerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a sale with items and payments' })
  get(
    @CurrentBusiness() business: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesService.get(business.id, id);
  }

  @Post(':id/payments')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Record a payment against a sale' })
  recordPayment(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.salesService.recordPayment(business.id, id, dto, {
      userId: user.id,
    });
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Cancel a sale and reverse inventory (owner/manager)' })
  cancel(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesService.cancel(business.id, id, { userId: user.id });
  }
}
