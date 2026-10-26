import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportExportService } from './report-export.service';
import { ReportsController } from './reports.controller';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Payment } from '../sales/entities/payment.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { DailyReportService } from './daily-report.service';
import { DailyReportDelivery } from './entities/daily-report-delivery.entity';
import { DailyReportSettings } from './entities/daily-report-settings.entity';
import { DailyReportDeliveryService } from './daily-report-delivery.service';
import { Business } from '../businesses/entities/business.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, SaleItem, Expense, Customer, Payment, Subscription, Business, User, DailyReportDelivery, DailyReportSettings]),
  ],
  providers: [ReportsService, ReportExportService, DailyReportService, DailyReportDeliveryService],
  controllers: [ReportsController],
})
export class ReportsModule {}
