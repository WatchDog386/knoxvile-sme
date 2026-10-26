import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EXPENSE_STATUSES } from '../../expenses/entities/expense.entity';

export class DateRangeQueryDto {
  @ApiPropertyOptional({ description: 'ISO date, inclusive start' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date, exclusive end' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ReportRangeQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

export class ExpenseExportQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({ enum: EXPENSE_STATUSES, default: 'APPROVED' })
  @IsOptional()
  @IsEnum(EXPENSE_STATUSES)
  status?: (typeof EXPENSE_STATUSES)[number];
}
