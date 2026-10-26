import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Service } from './entities/service.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ServicesController } from './services.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Service]),
    InventoryModule,
    AuditModule,
  ],
  providers: [ProductsService],
  controllers: [ProductsController, ServicesController],
  exports: [ProductsService, TypeOrmModule],
})
export class ProductsModule {}