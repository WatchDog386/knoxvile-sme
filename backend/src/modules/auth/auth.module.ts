import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { TrustedDevice } from '../users/entities/trusted-device.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { AuthService } from './auth.service';
import { PinService } from './pin.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './auth.strategy';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    AuditModule,
    TypeOrmModule.forFeature([User, BusinessMember, TrustedDevice]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.get<string>('jwt.expiresIn'),
        } as unknown as JwtModuleOptions['signOptions'],
      }),
    }),
  ],
  providers: [AuthService, PinService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
