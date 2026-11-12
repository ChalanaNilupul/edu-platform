import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthService } from './auth.service.js';

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
    emailVerifiedAt: Date | null;
  };
  sessionId?: string;
  activeWorkspaceId?: string | null;
};

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionToken = request.cookies?.edu_session as string | undefined;

    const result = await this.authService.getCurrentSession(sessionToken);

    request.user = result.user;
    request.sessionId = result.sessionId;
    request.activeWorkspaceId = result.activeWorkspaceId;

    return true;
  }
}
