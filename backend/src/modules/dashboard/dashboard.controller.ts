import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../../common/guards/business.guard';
import { CurrentBusiness, CurrentMembership } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/types/auth-user.interface';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, BusinessGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Daily KPIs, alerts, recent transactions and sales series' })
  async get(
    @CurrentBusiness() business: { id: string; timezone: string },
    @CurrentMembership() membership: { role: UserRole },
  ) {
    const dashboard = await this.dashboardService.getDashboard(business.id, business.timezone);
    // Employees get the working day (call list, subscribers) but never the money figures
    return membership.role === UserRole.EMPLOYEE ? this.dashboardService.withoutMoney(dashboard) : dashboard;
  }
}