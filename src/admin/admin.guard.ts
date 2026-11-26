
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';

export type AdminRequest = Request & {
  adminUser: {
    id: string;
  };
};

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AdminRequest>();

    const accessToken =
      request.cookies?.rekolta_access_token;

    if (
      typeof accessToken !== 'string' ||
      !accessToken
    ) {
      throw new UnauthorizedException(
        'You are not logged in.',
      );
    }

    const user =
      await this.authService.getCurrentUser(
        accessToken,
      );

    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Administrator access is required.',
      );
    }

    request.adminUser = {
      id: user.id,
    };

    return true;
  }
}
