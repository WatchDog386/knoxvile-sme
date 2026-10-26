import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { MpesaCallbackController, PaymentsController } from './payments.controller';
import { C2bService } from './c2b.service';
import { MpesaC2bListController, MpesaC2bWebhookController } from './c2b.controller';
import { MpesaC2bTransaction } from './entities/mpesa-c2b-transaction.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Product } from '../products/entities/product.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Business } from '../businesses/entities/business.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { SalesModule } from '../sales/sales.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MpesaC2bTransaction, Customer, Subscription, Product, Sale, Business, BusinessMember]),
    SalesModule,
  ],
  providers: [PaymentsService, C2bService],
  controllers: [PaymentsController, MpesaCallbackController, MpesaC2bWebhookController, MpesaC2bListController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
