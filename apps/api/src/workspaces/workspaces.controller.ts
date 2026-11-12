import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import type { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import type { WorkspacesService } from './workspaces.service.js';

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
  };
  sessionId?: string;
};

@Controller('workspaces')
@UseGuards(SessionAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(request.user!.id, request.sessionId!, dto);
  }

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.workspacesService.findAllForUser(request.user!.id);
  }

  @Post(':workspaceId/switch')
  switchWorkspace(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspacesService.switchWorkspace(
      request.user!.id,
      request.sessionId!,
      workspaceId,
    );
  }
}
