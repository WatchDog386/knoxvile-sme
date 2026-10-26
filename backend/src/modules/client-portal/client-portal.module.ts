import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../products/entities/product.entity';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Payment } from '../sales/entities/payment.entity';
import { SalesModule } from '../sales/sales.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PaymentsModule } from '../payments/payments.module';
import { DocumentsModule } from '../documents/documents.module';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { ClientPortalService } from './client-portal.service';
import { ClientAccessController, ClientPortalController } from './client-portal.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, Product, Sale, SaleItem, Payment]),
    SalesModule,
    SubscriptionsModule,
    PaymentsModule,
    DocumentsModule,
    UsersModule,
    AuditModule,
  ],
  providers: [ClientPortalService],
  controllers: [ClientPortalController, ClientAccessController],
})
export class ClientPortalModule {}
