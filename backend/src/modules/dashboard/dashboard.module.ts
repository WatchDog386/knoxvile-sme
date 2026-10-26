import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../products/entities/product.entity';
import { Payment } from '../sales/entities/payment.entity';
import { SalesModule } from '../sales/sales.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { RecurringExpensesModule } from '../recurring-expenses/recurring-expenses.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CallsModule } from '../calls/calls.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, SaleItem, Expense, Customer, Product, Payment]),
    SalesModule,
    ExpensesModule,
    BudgetsModule,
    RecurringExpensesModule,
    SubscriptionsModule,
    CallsModule,
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
