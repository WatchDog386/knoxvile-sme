import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SERVICE_TYPES = ['HOTSPOT', 'PPPOE', 'STATIC'] as const;

/** Subscriber account details (ISP billing), shared by create and update. */
class SubscriberFieldsDto {
  @ApiPropertyOptional({ example: 'FBI001' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'FBI001' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  username?: string;

  @ApiPropertyOptional({ example: ['0722000000'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  extraPhones?: string[];

  @ApiPropertyOptional({ example: 'A123456789B' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  kraPin?: string;

  @ApiPropertyOptional({ example: 'Imara Daima' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @ApiPropertyOptional({ example: 'Estate A' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  smsGroup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  newInstallation?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  walletBalance?: number;

  @ApiPropertyOptional({ enum: SERVICE_TYPES })
  @IsOptional()
  @IsIn(SERVICE_TYPES, { message: 'Choose Hotspot, PPPoE or Static IP.' })
  serviceType?: (typeof SERVICE_TYPES)[number];

  @ApiPropertyOptional({ example: 'IMARADAIMA' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  router?: string;

  @ApiPropertyOptional({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsOptional()
  @ValidateIf((_, v) => v !== '')
  @Matches(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/, { message: 'Enter the MAC address like AA:BB:CC:DD:EE:FF.' })
  macAddress?: string;

  @ApiPropertyOptional({ description: 'Blank keeps the current password' })
  @IsOptional()
  @IsString()
  @ValidateIf((_, v) => v !== '')
  @MinLength(4, { message: 'The service password needs at least 4 characters.' })
  @MaxLength(100)
  servicePassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  burstProductId?: string | null;

  @ApiPropertyOptional({ example: { mon: { from: '06:00', to: '22:00' } } })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsObject()
  accessHours?: Record<string, { from: string; to: string }> | null;
}

export class CreateCustomerDto extends SubscriberFieldsDto {
  @ApiProperty({ example: 'Mary Wanjiku' })
  @IsString()
  @IsNotEmpty({ message: 'Enter the customer name.' })
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: '0712345678' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'mary@example.com' })
  @IsOptional()
  @ValidateIf((_, v) => v !== '')
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email?: string;

  @ApiPropertyOptional({ example: 'Donholm, Nairobi' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: 'Gate code 4411' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCustomerDto extends SubscriberFieldsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== '')
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
