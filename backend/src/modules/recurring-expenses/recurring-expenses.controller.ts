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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RecurringExpensesService } from './recurring-expenses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../../common/guards/business.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentBusiness,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { AuthUser, UserRole } from '../../common/types/auth-user.interface';
import {
  CreateRecurringExpenseDto,
  UpdateRecurringExpenseDto,
} from './dto/recurring-expense.dto';

type BusinessCtx = { id: string; timezone: string };

@ApiTags('recurring-expenses')
@Controller('recurring-expenses')
@UseGuards(JwtAuthGuard, BusinessGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
@ApiBearerAuth()
export class RecurringExpensesController {
  constructor(private readonly service: RecurringExpensesService) {}

  @Get()
  @ApiOperation({ summary: 'List recurring expense templates' })
  async list(@CurrentBusiness() business: BusinessCtx) {
    await this.service.generateDue(business.id, business.timezone);
    return this.service.list(business.id, business.timezone);
  }

  @Post()
  @ApiOperation({ summary: 'Create a recurring expense' })
  create(
    @CurrentBusiness() business: BusinessCtx,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRecurringExpenseDto,
  ) {
    return this.service.create(business.id, dto, user.id, business.timezone);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a recurring expense' })
  update(
    @CurrentBusiness() business: BusinessCtx,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecurringExpenseDto,
  ) {
    return this.service.update(business.id, id, dto, user.id);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause a recurring expense' })
  pause(
    @CurrentBusiness() business: BusinessCtx,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.setActive(business.id, id, false, user.id, business.timezone);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a recurring expense' })
  resume(
    @CurrentBusiness() business: BusinessCtx,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.setActive(business.id, id, true, user.id, business.timezone);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a recurring expense' })
  remove(
    @CurrentBusiness() business: BusinessCtx,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(business.id, id, user.id);
  }
}
