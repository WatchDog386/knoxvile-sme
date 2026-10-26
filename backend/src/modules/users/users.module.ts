import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { TrustedDevice } from './entities/trusted-device.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, TrustedDevice])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}