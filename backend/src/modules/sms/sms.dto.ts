import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendSmsDto {
  @ApiProperty({ example: 'Hello John, your 10 Mbps package expires in 3 days. Renew via M-Pesa to stay connected.' })
  @IsString()
  @MinLength(1, { message: 'Write a message first.' })
  @MaxLength(900, { message: 'Keep the message under 900 characters.' })
  message: string;
}
export class SendWhatsappDto {
  @ApiProperty({ example: 'Hello Jane, your Knoxville invoice of KSh 1,499 is unpaid…' })
  @IsString()
  @MinLength(1, { message: 'Write a message first.' })
  @MaxLength(4000)
  message: string;

  /** Template variables, in order: first name, amount due, account number. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  params?: string[];
}
