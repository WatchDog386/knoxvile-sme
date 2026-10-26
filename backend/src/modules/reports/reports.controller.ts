import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { DailyReportService, toReportPeriod } from './daily-report.service';
import { DailyReportDeliveryService } from './daily-report-delivery.service';
import { UpdateDailyReportDeliveryDto } from './dto/daily-report-delivery.dto';
import {
  ExportContext,
  ExportFile,
  ReportExportService,
} from './report-export.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../../common/guards/business.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentBusiness } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/types/auth-user.interface';
import {
  DateRangeQueryDto,
  ExpenseExportQueryDto,
  ReportRangeQueryDto,
} from './dto/report.dto';

type BusinessCtx = { id: string; name: string; timezone: string; currency: string };

function exportContext(business: BusinessCtx, query: DateRangeQueryDto): ExportContext {
  return {
    businessId: business.id,
    businessName: business.name,
    timezone: business.timezone,
    currency: business.currency,
    from: query.from,
    to: query.to,
  };
}

function sendFile(res: Response, file: ExportFile): void {
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.send(file.buffer);
}

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, BusinessGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
@ApiBearerAuth()
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly exportService: ReportExportService,
    private readonly dailyReports: DailyReportService,
    private readonly delivery: DailyReportDeliveryService,
  ) {}

  @Get('day')
  @ApiOperation({ summary: 'Report for the day, week, month or year containing a date (business timezone); today by default' })
  @ApiQuery({ name: 'date', required: false, example: '2026-10-11' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month', 'year'] })
  day(
    @CurrentBusiness() business: { id: string; timezone: string },
    @Query('date') date?: string,
    @Query('period') period?: string,
  ) {
    return this.dailyReports.report(business.id, date, business.timezone, toReportPeriod(period));
  }

  @Get('day/history')
  @ApiOperation({ summary: 'Revenue, expenses and net profit per day, week, month or year, up to a date' })
  @ApiQuery({ name: 'days', required: false, description: 'How many periods' })
  @ApiQuery({ name: 'until', required: false })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month', 'year'] })
  dayHistory(
    @CurrentBusiness() business: { id: string; timezone: string },
    @Query('days') days?: string,
    @Query('until') until?: string,
    @Query('period') period?: string,
  ) {
    const p = toReportPeriod(period);
    const max = { day: 31, week: 26, month: 24, year: 10 }[p];
    const n = Math.min(max, Math.max(1, Number(days) || 7));
    return this.dailyReports.history(business.id, n, until, business.timezone, p);
  }

  @Get('day/export.pdf')
  @ApiOperation({ summary: 'Daily report as a PDF' })
  async dayPdf(
    @CurrentBusiness() business: BusinessCtx,
    @Query('date') date: string | undefined,
    @Query('period') period: string | undefined,
    @Res() res: Response,
  ) {
    sendFile(res, await this.exportService.dailyPdf(exportContext(business, {}), date, undefined, toReportPeriod(period)));
  }

  @Get('day/export.xlsx')
  @ApiOperation({ summary: 'Daily report as a detailed Excel workbook' })
  async dayXlsx(
    @CurrentBusiness() business: BusinessCtx,
    @Query('date') date: string | undefined,
    @Query('period') period: string | undefined,
    @Res() res: Response,
  ) {
    sendFile(res, await this.exportService.dailyXlsx(exportContext(business, {}), date, undefined, toReportPeriod(period)));
  }

  @Get('delivery')
  @ApiOperation({ summary: 'Daily report email settings and latest delivery status' })
  deliverySettings(@CurrentBusiness() business: { id: string }) {
    return this.delivery.settings(business.id);
  }

  @Patch('delivery')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Set the daily report email recipient or pause automatic delivery' })
  updateDeliverySettings(
    @CurrentBusiness() business: { id: string },
    @Body() dto: UpdateDailyReportDeliveryDto,
  ) {
    return this.delivery.updateSettings(business.id, dto);
  }

  @Get('profit-loss')
  @ApiOperation({ summary: 'Profit & loss: revenue, COGS, gross profit, expenses, net profit' })
  profitLoss(
    @CurrentBusiness() business: { id: string; timezone: string },
    @Query() query: DateRangeQueryDto,
  ) {
    return this.reportsService.profitLoss(
      business.id,
      query.from,
      query.to,
      business.timezone,
    );
  }

  @Get('daily-summary')
  @ApiOperation({ summary: 'Daily revenue, COGS, expenses and profit' })
  dailySummary(
    @CurrentBusiness() business: { id: string; timezone: string },
    @Query() query: DateRangeQueryDto,
  ) {
    return this.reportsService.dailySummary(
      business.id,
      query.from,
      query.to,
      business.timezone,
    );
  }

  @Get('products')
  @ApiOperation({ summary: 'Product & service performance' })
  products(
    @CurrentBusiness() business: { id: string },
    @Query() query: ReportRangeQueryDto,
  ) {
    return this.reportsService.productPerformance(
      business.id,
      query.from,
      query.to,
      query.limit ?? 10,
    );
  }

  @Get('customers')
  @ApiOperation({ summary: 'Customer performance by total spend' })
  customers(
    @CurrentBusiness() business: { id: string },
    @Query() query: { limit?: number },
  ) {
    return this.reportsService.customerPerformance(business.id, query.limit ?? 10);
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Expense summary by category' })
  expenses(
    @CurrentBusiness() business: { id: string },
    @Query() query: DateRangeQueryDto,
  ) {
    return this.reportsService.expenseSummary(business.id, query.from, query.to);
  }

  @Get('sales/export.csv')
  @ApiOperation({ summary: 'Export sales as CSV' })
  async salesCsv(
    @CurrentBusiness() business: { id: string },
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.reportsService.salesCsv(
      business.id,
      query.from,
      query.to,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sales-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(csv);
  }

  @Get('profit-loss/export.xlsx')
  @ApiOperation({ summary: 'Export profit & loss as Excel' })
  async profitLossXlsx(
    @CurrentBusiness() business: BusinessCtx,
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    sendFile(res, await this.exportService.profitLossXlsx(exportContext(business, query)));
  }

  @Get('profit-loss/export.pdf')
  @ApiOperation({ summary: 'Export profit & loss as PDF' })
  async profitLossPdf(
    @CurrentBusiness() business: BusinessCtx,
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    sendFile(res, await this.exportService.profitLossPdf(exportContext(business, query)));
  }

  @Get('expenses/export.xlsx')
  @ApiOperation({ summary: 'Export expenses as Excel' })
  async expensesXlsx(
    @CurrentBusiness() business: BusinessCtx,
    @Query() query: ExpenseExportQueryDto,
    @Res() res: Response,
  ) {
    sendFile(
      res,
      await this.exportService.expensesXlsx(exportContext(business, query), query.status),
    );
  }

  @Get('expenses/export.pdf')
  @ApiOperation({ summary: 'Export expenses as PDF' })
  async expensesPdf(
    @CurrentBusiness() business: BusinessCtx,
    @Query() query: ExpenseExportQueryDto,
    @Res() res: Response,
  ) {
    sendFile(
      res,
      await this.exportService.expensesPdf(exportContext(business, query), query.status),
    );
  }
}
