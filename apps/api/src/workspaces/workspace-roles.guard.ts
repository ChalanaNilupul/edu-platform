import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest } from '../common/types/authenticated-request.js';
import { WorkspaceRole } from '../generated/prisma/client.js';
import { WORKSPACE_ROLES_KEY } from './workspace-roles.decorator.js';
import { WorkspaceAccessService } from './workspace-access.service.js';

@Injectable()
export class WorkspaceRolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(WORKSPACE_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const workspaceId = request.params.workspaceId;

    if (!workspaceId) {
      throw new ForbiddenException('Workspace context is required');
    }

    if (!request.user) {
      throw new ForbiddenException('Not authenticated');
    }

    const membership = await this.workspaceAccess.getActiveMembership(request.user.id, workspaceId);

    if (
      requiredRoles?.length &&
      membership.role !== WorkspaceRole.OWNER &&
      !requiredRoles.includes(membership.role)
    ) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    request.workspaceMembership = membership;

    return true;
  }
}
