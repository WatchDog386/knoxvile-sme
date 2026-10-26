import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from '../businesses/entities/business.entity';
import { SalesModule } from '../sales/sales.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { DocumentsService } from './documents.service';
import { CustomerEmailController, DocumentsController, PublicDocumentsController } from './documents.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Business]), SalesModule, SubscriptionsModule],
  providers: [DocumentsService],
  controllers: [DocumentsController, CustomerEmailController, PublicDocumentsController],
  exports: [DocumentsService],
})
export class DocumentsModule {}
