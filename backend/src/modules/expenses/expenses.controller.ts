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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExpenseActor, ExpensesService } from './expenses.service';
import { RecurringExpensesService } from '../recurring-expenses/recurring-expenses.service';
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
import {
  CreateExpenseDto,
  ExpensesListQueryDto,
  RejectExpenseDto,
  UpdateExpenseDto,
} from './dto/expense.dto';

type BusinessCtx = { id: string; timezone: string };
type MembershipCtx = { role: UserRole };

function actorOf(user: AuthUser, membership: MembershipCtx): ExpenseActor {
  return { id: user.id, role: membership.role };
}

@ApiTags('expenses')
@Controller('expenses')
@UseGuards(JwtAuthGuard, BusinessGuard)
@ApiBearerAuth()
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly recurringExpensesService: RecurringExpensesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List expenses (employees see only their own)' })
  async list(
    @CurrentBusiness() business: BusinessCtx,
    @CurrentUser() user: AuthUser,
    @CurrentMembership() membership: MembershipCtx,
    @Query() query: ExpensesListQueryDto,
  ) {
    // Catch up on recurring expenses in case the daily job did not run.
    await this.recurringExpensesService.generateDue(business.id, business.timezone);
    return this.expensesService.list(business.id, query, actorOf(user, membership), business.timezone);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an expense' })
  get(
    @CurrentBusiness() business: BusinessCtx,
    @CurrentUser() user: AuthUser,
    @CurrentMembership() membership: MembershipCtx,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.expensesService.get(business.id, id, actorOf(user, membership));
  }

  @Post()
  @ApiOperation({
    summary: 'Record an expense (employee submissions start as PENDING)',
  })
  create(
    @CurrentBusiness() business: BusinessCtx,
    @CurrentUser() user: AuthUser,
    @CurrentMembership() membership: MembershipCtx,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(business.id, dto, actorOf(user, membership), business.timezone);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an expense' })
  update(
    @CurrentBusiness() business: BusinessCtx,
    @CurrentUser() user: AuthUser,
    @CurrentMembership() membership: MembershipCtx,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(
      business.id,
      id,
      dto,
      actorOf(user, membership),
      business.timezone,
    );
  }

  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Approve a pending expense' })
  approve(
    @CurrentBusiness() business: BusinessCtx,
    @CurrentUser() user: AuthUser,
    @CurrentMembership() membership: MembershipCtx,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.expensesService.approve(business.id, id, actorOf(user, membership));
  }

  @Patch(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Reject a pending expense with a reason' })
  reject(
    @CurrentBusiness() business: BusinessCtx,
    @CurrentUser() user: AuthUser,
    @CurrentMembership() membership: MembershipCtx,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectExpenseDto,
  ) {
    return this.expensesService.reject(
      business.id,
      id,
      dto.reason,
      actorOf(user, membership),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Delete an expense (owner/manager, or an employee\'s own pending one)',
  })
  remove(
    @CurrentBusiness() business: BusinessCtx,
    @CurrentUser() user: AuthUser,
    @CurrentMembership() membership: MembershipCtx,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.expensesService.remove(business.id, id, actorOf(user, membership));
  }
}
