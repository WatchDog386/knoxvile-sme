import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BUSINESS_TYPES } from '../entities/business.entity';
import { STAFF_ROLES, UserRole } from '../../../common/types/auth-user.interface';

export class CreateBusinessDto {
  @ApiProperty({ example: 'Mama Njeri Salon' })
  @IsString()
  @IsNotEmpty({ message: 'Enter your business name.' })
  @MaxLength(150)
  name: string;

  @ApiProperty({ enum: BUSINESS_TYPES, example: 'SALON' })
  @IsIn(BUSINESS_TYPES, { message: 'Select a valid business type.' })
  businessType: string;

  @ApiPropertyOptional({ example: '0712345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Umoja, Nairobi' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Nairobi' })
  @IsOptional()
  @IsString()
  county?: string;

  @ApiPropertyOptional({ example: 'KES', default: 'KES' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'Africa/Nairobi', default: 'Africa/Nairobi' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

export class UpdateBusinessDto {
  @ApiPropertyOptional({ example: 'Mama Njeri Salon & Spa' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ enum: BUSINESS_TYPES })
  @IsOptional()
  @IsIn(BUSINESS_TYPES)
  businessType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  county?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

export class AddMemberDto {
  @ApiProperty({ example: 'mercy@example.com' })
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email: string;

  @ApiProperty({ enum: STAFF_ROLES, example: UserRole.MANAGER })
  @IsIn([...STAFF_ROLES], { message: 'Select a valid role.' })
  role: UserRole;

  // Required when the person has no account yet — the owner creates their login
  @ApiPropertyOptional({ example: 'Mercy Wanjiru' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: '0712345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'secret123', minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  password?: string;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: STAFF_ROLES, example: UserRole.ACCOUNTANT })
  @IsIn([...STAFF_ROLES], { message: 'Select a valid role.' })
  role: UserRole;
}