import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PAYMENT_METHODS, SALE_TYPES } from '../entities/sale.entity';

export class SaleItemInputDto {
  @ApiPropertyOptional({ example: 'uuid-of-product' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-service' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateSaleDto {
  @ApiPropertyOptional({ enum: SALE_TYPES })
  @IsOptional()
  @IsEnum(SALE_TYPES)
  saleType?: (typeof SALE_TYPES)[number];

  @ApiPropertyOptional({ description: 'Apply the client’s available advance credit to this product or service sale.' })
  @IsOptional()
  @IsBoolean()
  applyAdvances?: boolean;

  @ApiProperty({
    type: [SaleItemInputDto],
    description:
      'Line items. May be empty only when `total` is provided (amount-only express sale, e.g. recorded from an M-Pesa SMS).',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items: SaleItemInputDto[];

  @ApiPropertyOptional({
    example: 1500,
    description:
      'Explicit sale total for amount-only express sales. Required when `items` is empty.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  total?: number;

  @ApiPropertyOptional({ example: 'uuid-of-customer' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-employee' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ example: 16, description: 'Tax rate as a percentage, e.g. 16 for 16%' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @ApiProperty({ enum: PAYMENT_METHODS, example: 'CASH' })
  @IsEnum(PAYMENT_METHODS, { message: 'Select a valid payment method.' })
  paymentMethod: string;

  @ApiPropertyOptional({
    example: 0,
    description:
      'Amount paid now. For credit sales leave 0; for partial payments enter the amount received.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountPaid?: number;

  @ApiPropertyOptional({ example: 'QRT8XYZ9A1' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional({ example: 'Walk-in customer' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: 'random-uuid-generated-on-the-client' })
  @IsString()
  @IsNotEmpty({ message: 'Idempotency key is required.' })
  @MaxLength(64)
  idempotencyKey: string;

  @ApiPropertyOptional({
    example: '2026-10-14',
    description: 'Day the sale happened (YYYY-MM-DD): today or any earlier day. Defaults to today.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Pick a valid date.' })
  saleDate?: string;

  @ApiPropertyOptional({ example: 'uuid-of-sale-category' })
  @IsOptional()
  @IsUUID('4', { message: 'Pick a valid category.' })
  categoryId?: string;

  @ApiPropertyOptional({
    example: 2500,
    description: 'New installation: extra charge (KSh) added to a WiFi package sale as its own line.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Enter the installation charge in whole shillings.' })
  @Min(0)
  @Max(10_000_000)
  installationFee?: number;
}

export class RecordPaymentDto {
  @ApiProperty({ example: 500 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ enum: PAYMENT_METHODS, example: 'M-PESA' })
  @IsEnum(PAYMENT_METHODS, { message: 'Select a valid payment method.' })
  method: string;

  @ApiPropertyOptional({ example: 'QRT8XYZ9A1' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
