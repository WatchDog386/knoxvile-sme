import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CALL_CHANNELS, CALL_OUTCOMES } from './entities/call-log.entity';

export class CreateCallLogDto {
  @ApiProperty({ enum: CALL_OUTCOMES })
  @IsIn(CALL_OUTCOMES, { message: 'Choose how the call went.' })
  outcome: (typeof CALL_OUTCOMES)[number];

  @ApiPropertyOptional({ enum: CALL_CHANNELS, default: 'PHONE' })
  @IsOptional()
  @IsIn(CALL_CHANNELS)
  channel?: (typeof CALL_CHANNELS)[number];

  @ApiPropertyOptional({ example: 'Will pay on Friday via M-Pesa' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Schedule a call-back (ISO date-time)' })
  @IsOptional()
  @IsDateString({}, { message: 'Pick a valid call-back date.' })
  followUpAt?: string;
}
