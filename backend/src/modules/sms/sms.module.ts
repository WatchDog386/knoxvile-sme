import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { CallsModule } from '../calls/calls.module';
import { SmsService } from './sms.service';
import { WhatsappService } from './whatsapp.service';
import { DocumentsModule } from '../documents/documents.module';
import { SmsController } from './sms.controller';
import { MobileSasaWebhookController } from './mobilesasa-webhook.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Customer]), CallsModule, DocumentsModule],
  providers: [SmsService, WhatsappService],
  controllers: [SmsController, MobileSasaWebhookController],
  exports: [SmsService, WhatsappService],
})
export class SmsModule {}