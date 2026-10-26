import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessGuard } from './guards/business.guard';
import { Business } from '../modules/businesses/entities/business.entity';
import { BusinessMember } from '../modules/businesses/entities/business-member.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Business, BusinessMember])],
  providers: [BusinessGuard],
  exports: [BusinessGuard, TypeOrmModule],
})
export class CommonModule {}