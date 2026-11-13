import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';

import { CurrentSessionId, CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-request.js';
import { WorkspaceRole } from '../generated/prisma/client.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { InviteMemberDto } from './dto/invite-member.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import { InvitationsService } from './invitations.service.js';
import { MembershipsService } from './memberships.service.js';
import { WorkspaceRoles } from './workspace-roles.decorator.js';
import { WorkspaceRolesGuard } from './workspace-roles.guard.js';
import { WorkspacesService } from './workspaces.service.js';

@Controller('workspaces')
export class WorkspacesController {
  constructor(
    @Inject(WorkspacesService) private readonly workspacesService: WorkspacesService,
    @Inject(MembershipsService) private readonly membershipsService: MembershipsService,
    @Inject(InvitationsService) private readonly invitationsService: InvitationsService,
  ) {}

  @UseGuards(SessionAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSessionId() sessionId: string,
    @Body(new ValidationPipe({ expectedType: CreateWorkspaceDto })) dto: CreateWorkspaceDto,
  ) {
    return this.workspacesService.create(user.id, user.emailVerifiedAt, sessionId, dto);
  }

  @UseGuards(SessionAuthGuard)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.workspacesService.findAllForUser(user.id);
  }

  @UseGuards(SessionAuthGuard)
  @Get(':workspaceId')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspacesService.getById(user.id, workspaceId);
  }

  @UseGuards(SessionAuthGuard)
  @Post(':workspaceId/switch')
  @HttpCode(HttpStatus.OK)
  switchWorkspace(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSessionId() sessionId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspacesService.switchWorkspace(user.id, sessionId, workspaceId);
  }

  @UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
  @WorkspaceRoles(WorkspaceRole.ADMIN)
  @Get(':workspaceId/members')
  listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.membershipsService.list(user.id, workspaceId);
  }

  @UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER)
  @Patch(':workspaceId/members/:membershipId')
  updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body(new ValidationPipe({ expectedType: UpdateMemberRoleDto })) dto: UpdateMemberRoleDto,
  ) {
    return this.membershipsService.updateRole(user.id, workspaceId, membershipId, dto.role);
  }

  @UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
  @WorkspaceRoles(WorkspaceRole.ADMIN)
  @Delete(':workspaceId/members/:membershipId')
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ) {
    return this.membershipsService.remove(user.id, workspaceId, membershipId);
  }

  @UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
  @WorkspaceRoles(WorkspaceRole.ADMIN)
  @Get(':workspaceId/invitations')
  listInvitations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.invitationsService.list(user.id, workspaceId);
  }

  @UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
  @WorkspaceRoles(WorkspaceRole.ADMIN)
  @Post(':workspaceId/invitations')
  @HttpCode(HttpStatus.CREATED)
  inviteMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body(new ValidationPipe({ expectedType: InviteMemberDto })) dto: InviteMemberDto,
  ) {
    return this.invitationsService.create(
      user.id,
      user.emailVerifiedAt,
      workspaceId,
      dto.email,
      dto.role,
    );
  }

  @UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
  @WorkspaceRoles(WorkspaceRole.ADMIN)
  @Delete(':workspaceId/invitations/:invitationId')
  revokeInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.invitationsService.revoke(user.id, workspaceId, invitationId);
  }
}
