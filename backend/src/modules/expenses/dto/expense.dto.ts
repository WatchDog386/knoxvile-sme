import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_STATUSES,
} from '../entities/expense.entity';

/** Data-URL receipts up to ~2 MB of file data (base64 adds ~37%). */
export const RECEIPT_MAX_LENGTH = 2_900_000;

export class CreateExpenseDto {
  @ApiProperty({ example: 'Rent for shop' })
  @IsString()
  @IsNotEmpty({ message: 'Describe this expense.' })
  @MaxLength(150)
  description: string;

  @ApiProperty({ example: 8500 })
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Enter a valid amount.' })
  amount: number;

  @ApiPropertyOptional({ example: 'uuid-of-expense-category' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: EXPENSE_PAYMENT_METHODS, default: 'CASH' })
  @IsOptional()
  @IsEnum(EXPENSE_PAYMENT_METHODS)
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(RECEIPT_MAX_LENGTH, { message: 'Receipt must be 2 MB or smaller.' })
  receiptUrl?: string;

  @ApiPropertyOptional({ example: '2026-08-19' })
  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class UpdateExpenseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: EXPENSE_PAYMENT_METHODS })
  @IsOptional()
  @IsEnum(EXPENSE_PAYMENT_METHODS)
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(RECEIPT_MAX_LENGTH, { message: 'Receipt must be 2 MB or smaller.' })
  receiptUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class ExpensesListQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: EXPENSE_STATUSES })
  @IsOptional()
  @IsEnum(EXPENSE_STATUSES)
  status?: (typeof EXPENSE_STATUSES)[number];

  @ApiPropertyOptional({ enum: EXPENSE_PAYMENT_METHODS })
  @IsOptional()
  @IsIn(EXPENSE_PAYMENT_METHODS)
  paymentMethod?: string;
}

export class RejectExpenseDto {
  @ApiProperty({ example: 'No receipt attached' })
  @IsString()
  @IsNotEmpty({ message: 'Give a reason for rejecting this expense.' })
  @MaxLength(300)
  reason: string;
}
