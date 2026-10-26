import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from './entities/expense.entity';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { AuditModule } from '../audit/audit.module';
import { RecurringExpensesModule } from '../recurring-expenses/recurring-expenses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense]),
    AuditModule,
    RecurringExpensesModule,
  ],
  providers: [ExpensesService],
  controllers: [ExpensesController],
  exports: [ExpensesService, TypeOrmModule],
})
export class ExpensesModule {}
