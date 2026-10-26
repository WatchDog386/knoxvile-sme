import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestWithUser, UserRole } from '../types/auth-user.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.membership) {
      throw new UnauthorizedException({
        code: 'NO_MEMBERSHIP',
        message: 'You must be a member of a business to perform this action.',
      });
    }
    const hasRole = requiredRoles.includes(request.membership.role);
    if (!hasRole) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'You do not have permission to perform this action.',
      });
    }
    return true;
  }
}