import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Budget } from './entities/budget.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Category } from '../categories/entities/category.entity';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Budget, Expense, Category]), AuditModule],
  providers: [BudgetsService],
  controllers: [BudgetsController],
  exports: [BudgetsService, TypeOrmModule],
})
export class BudgetsModule {}
