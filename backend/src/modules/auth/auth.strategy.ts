import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
  fullName: string;
  /** Set only on sessions issued after a passed two-factor check. */
  mfa?: boolean;
  /** Present on short-lived 2FA tickets, which are never sessions. */
  purpose?: string;
  /** Issued-at, in seconds; set by the JWT library. */
  iat?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret') ?? 'dev-secret-change-me',
    });
  }

  async validate(payload: JwtPayload) {
    // Two-factor sign-in is mandatory: older sessions without it must sign in again
    if (payload.purpose || payload.mfa !== true) {
      throw new UnauthorizedException({
        code: 'TWO_FACTOR_REQUIRED',
        message: 'Please sign in again with your authenticator code.',
      });
    }
    const user = await this.usersService.findById(payload.sub);
    // Sessions from before the last password change are over (iat is whole seconds)
    const cutoff = user?.sessions_valid_after ? Math.floor(user.sessions_valid_after.getTime() / 1000) : 0;
    if (!user || (payload.iat ?? 0) < cutoff) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Your session is no longer valid. Sign in again.',
      });
    }
    return { id: user.id, email: user.email, fullName: user.full_name };
  }
}