import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { Payment } from './entities/payment.entity';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { AuditModule } from '../audit/audit.module';
import { CustomersModule } from '../customers/customers.module';
import { Product } from '../products/entities/product.entity';
import { Service } from '../products/entities/service.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, SaleItem, Payment, Product, Service]),
    InventoryModule,
    AuditModule,
    CustomersModule,
    SubscriptionsModule,
  ],
  providers: [SalesService],
  controllers: [SalesController],
  exports: [SalesService, TypeOrmModule],
})
export class SalesModule {}