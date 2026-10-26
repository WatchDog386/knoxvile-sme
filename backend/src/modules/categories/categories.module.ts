import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Category]), AuditModule],
  providers: [CategoriesService],
  controllers: [CategoriesController],
  exports: [CategoriesService, TypeOrmModule],
})
export class CategoriesModule {}