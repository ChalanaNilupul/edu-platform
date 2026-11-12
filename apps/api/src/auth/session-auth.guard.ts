import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.js';
import { AuthService } from './auth.service.js';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

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
