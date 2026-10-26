import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CATEGORY_TYPES } from '../entities/category.entity';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Hair Products' })
  @IsString()
  @IsNotEmpty({ message: 'Enter a category name.' })
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: CATEGORY_TYPES, example: 'PRODUCT' })
  @IsIn(CATEGORY_TYPES, { message: 'Select a valid category type.' })
  type: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Haircare' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}