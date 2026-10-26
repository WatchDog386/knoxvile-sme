import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProductsModule } from './modules/products/products.module';
import { SalesModule } from './modules/sales/sales.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { RecurringExpensesModule } from './modules/recurring-expenses/recurring-expenses.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { CallsModule } from './modules/calls/calls.module';
import { SmsModule } from './modules/sms/sms.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ClientPortalModule } from './modules/client-portal/client-portal.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['backend/.env', '.env'],
    }),
    ScheduleModule.forRoot(),
    // Per-IP request ceiling for the whole API; sign-in routes set tighter ones
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
      errorMessage: 'Too many requests. Wait a minute, then try again.',
    }),
    DatabaseModule,
    CommonModule,
    AuditModule,
    AuthModule,
    UsersModule,
    BusinessesModule,
    CategoriesModule,
    CustomersModule,
    ProductsModule,
    SalesModule,
    ExpensesModule,
    BudgetsModule,
    RecurringExpensesModule,
    SubscriptionsModule,
    CallsModule,
    SmsModule,
    DocumentsModule,
    PaymentsModule,
    ClientPortalModule,
    DashboardModule,
    ReportsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}