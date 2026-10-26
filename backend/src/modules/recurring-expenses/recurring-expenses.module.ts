import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecurringExpense } from './entities/recurring-expense.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Business } from '../businesses/entities/business.entity';
import { RecurringExpensesService } from './recurring-expenses.service';
import { RecurringExpensesController } from './recurring-expenses.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecurringExpense, Expense, Business]),
    AuditModule,
  ],
  providers: [RecurringExpensesService],
  controllers: [RecurringExpensesController],
  exports: [RecurringExpensesService, TypeOrmModule],
})
export class RecurringExpensesModule {}
