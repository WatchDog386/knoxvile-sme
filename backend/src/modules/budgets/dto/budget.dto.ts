import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBudgetDto {
  @ApiProperty({ example: 'uuid-of-expense-category' })
  @IsUUID('all', { message: 'Select a category.' })
  categoryId: string;

  @ApiProperty({ example: 50000 })
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Enter a monthly limit.' })
  monthlyLimit: number;

  @ApiPropertyOptional({ example: 80, default: 80 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  alertThreshold?: number;
}

export class UpdateBudgetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  monthlyLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  alertThreshold?: number;
}

export class BudgetStatusQueryDto {
  @ApiPropertyOptional({ example: '2026-10', description: 'Defaults to this month' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Use a YYYY-MM month.' })
  month?: string;
}
