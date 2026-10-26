import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Hair Relaxer 500ml' })
  @IsString()
  @IsNotEmpty({ message: 'Enter the product name.' })
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'HR-500' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({ example: 450 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  costPrice: number;

  @ApiProperty({ example: 800 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sellingPrice: number;

  @ApiPropertyOptional({ example: 20, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @ApiPropertyOptional({ example: 30, description: 'WiFi package: days of access per purchase (makes this a package)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  billingDays?: number | null;

  @ApiPropertyOptional({ example: 20, description: 'WiFi package speed in Mbps' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  speedMbps?: number | null;

  @ApiPropertyOptional({ example: 'Great for browsing and streaming' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sellingPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ example: 30, description: 'WiFi package: days of access per purchase (makes this a package)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  billingDays?: number | null;

  @ApiPropertyOptional({ example: 20, description: 'WiFi package speed in Mbps' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  speedMbps?: number | null;

  @ApiPropertyOptional({ example: 'Great for browsing and streaming' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class StockMovementDto {
  @ApiProperty({ example: 10, description: 'Positive quantity. Use reason to clarify direction.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 'New delivery from supplier' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class CreateServiceDto {
  @ApiProperty({ example: 'Hair Braiding' })
  @IsString()
  @IsNotEmpty({ message: 'Enter the service name.' })
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'Full braiding, about 3 hours' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 1500 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export class UpdateServiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}