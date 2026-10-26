import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../../common/guards/business.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentBusiness,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { AuthUser, UserRole } from '../../common/types/auth-user.interface';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('customers')
@Controller('customers')
@UseGuards(JwtAuthGuard, BusinessGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'List customers with optional search' })
  @ApiQuery({ name: 'search', required: false })
  list(
    @CurrentBusiness() business: { id: string },
    @Query() query: PaginationQueryDto & { search?: string },
  ) {
    return this.customersService.list(business.id, query);
  }

  @Get('options')
  @ApiOperation({ summary: 'Known locations, SMS groups, routers and the next account number' })
  options(@CurrentBusiness() business: { id: string }) {
    return this.customersService.options(business.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single customer' })
  get(
    @CurrentBusiness() business: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customersService.get(business.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a customer' })
  create(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create(business.id, dto, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a customer' })
  update(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(business.id, id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a customer (owner/manager only)' })
  remove(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customersService.remove(business.id, id, user.id);
  }
}