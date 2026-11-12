import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequest } from '../common/types/authenticated-request.js';
import { MembershipStatus, WorkspaceRole } from '../generated/prisma/client.js';
import type { WorkspaceAccessService } from './workspace-access.service.js';
import { WorkspaceRolesGuard } from './workspace-roles.guard.js';

describe('WorkspaceRolesGuard', () => {
  const reflectorMock = {
    getAllAndOverride: vi.fn(),
  };

  const workspaceAccessMock = {
    getActiveMembership: vi.fn(),
    requireRoles: vi.fn(),
  };

  let guard: WorkspaceRolesGuard;

  const user = {
    id: 'user-123',
    firstName: 'Chalana',
    lastName: null,
    email: 'test@example.com',
    emailVerifiedAt: null,
  };

  const createContext = (request: Partial<AuthenticatedRequest>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    vi.resetAllMocks();
    guard = new WorkspaceRolesGuard(
      reflectorMock as unknown as Reflector,
      workspaceAccessMock as unknown as WorkspaceAccessService,
    );
  });

  it('skips the lookup when the route has no workspaceId parameter', async () => {
    const request = { user, params: {} };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(workspaceAccessMock.getActiveMembership).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request', async () => {
    const request = { params: { workspaceId: 'workspace-123' } };

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(workspaceAccessMock.getActiveMembership).not.toHaveBeenCalled();
  });

  it('attaches the active membership to the request', async () => {
    const membership = {
      id: 'membership-123',
      role: WorkspaceRole.TEACHER,
      status: MembershipStatus.ACTIVE,
    };

    reflectorMock.getAllAndOverride.mockReturnValue(undefined);
    workspaceAccessMock.getActiveMembership.mockResolvedValue(membership);

    const request: Partial<AuthenticatedRequest> = {
      user,
      params: { workspaceId: 'workspace-123' },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(workspaceAccessMock.getActiveMembership).toHaveBeenCalledWith(
      'user-123',
      'workspace-123',
    );
    expect(request.workspaceMembership).toEqual(membership);
  });

  it('rejects a member without a required role', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue([WorkspaceRole.ADMIN]);
    workspaceAccessMock.getActiveMembership.mockResolvedValue({
      id: 'membership-123',
      role: WorkspaceRole.TEACHER,
      status: MembershipStatus.ACTIVE,
    });

    const request = {
      user,
      params: { workspaceId: 'workspace-123' },
    };

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows the owner regardless of the required roles', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue([WorkspaceRole.ADMIN]);
    workspaceAccessMock.getActiveMembership.mockResolvedValue({
      id: 'membership-123',
      role: WorkspaceRole.OWNER,
      status: MembershipStatus.ACTIVE,
    });

    const request = {
      user,
      params: { workspaceId: 'workspace-123' },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
  });
});
