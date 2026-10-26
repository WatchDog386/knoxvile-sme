import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from './entities/business.entity';
import { BusinessMember } from './entities/business-member.entity';
import { BusinessesService } from './businesses.service';
import { BusinessesController } from './businesses.controller';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Business, BusinessMember]),
    UsersModule,
    AuditModule,
  ],
  providers: [BusinessesService],
  controllers: [BusinessesController],
  exports: [BusinessesService, TypeOrmModule],
})
export class BusinessesModule {}