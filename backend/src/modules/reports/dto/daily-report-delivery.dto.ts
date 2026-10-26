import { IsBoolean, IsEmail, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDailyReportDeliveryDto {
  @ApiPropertyOptional({ example: 'owner@business.co.ke', nullable: true })
  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid report email address.' })
  @MaxLength(320)
  email?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
