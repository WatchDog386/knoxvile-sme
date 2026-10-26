import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EXPENSE_PAYMENT_METHODS } from '../../expenses/entities/expense.entity';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateRecurringExpenseDto {
  @ApiProperty({ example: 'Office rent' })
  @IsString()
  @IsNotEmpty({ message: 'Describe this expense.' })
  @MaxLength(150)
  description: string;

  @ApiProperty({ example: 45000 })
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Enter a valid amount.' })
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: EXPENSE_PAYMENT_METHODS, default: 'BANK' })
  @IsOptional()
  @IsEnum(EXPENSE_PAYMENT_METHODS)
  paymentMethod?: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 28 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28, { message: 'Pick a day between 1 and 28.' })
  dayOfMonth: number;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'Use a YYYY-MM-DD start date.' })
  startDate?: string;

  @ApiPropertyOptional({ example: '2027-09-30' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(DATE_PATTERN, { message: 'Use a YYYY-MM-DD end date.' })
  endDate?: string | null;
}

export class UpdateRecurringExpenseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
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
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({ enum: EXPENSE_PAYMENT_METHODS })
  @IsOptional()
  @IsEnum(EXPENSE_PAYMENT_METHODS)
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  dayOfMonth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(DATE_PATTERN)
  endDate?: string | null;
}
