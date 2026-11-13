import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';

import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-request.js';
import { WorkspaceRole } from '../generated/prisma/client.js';
import { WorkspaceRoles } from '../workspaces/workspace-roles.decorator.js';
import { WorkspaceRolesGuard } from '../workspaces/workspace-roles.guard.js';
import { ListTeachersQueryDto } from './dto/list-teachers.query.js';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto.js';
import { TeachersService } from './teachers.service.js';

@Controller('workspaces/:workspaceId/teachers')
@UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
export class TeachersController {
  constructor(@Inject(TeachersService) private readonly teachersService: TeachersService) {}

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query(new ValidationPipe({ expectedType: ListTeachersQueryDto, transform: true }))
    query: ListTeachersQueryDto,
  ) {
    return this.teachersService.list(user.id, workspaceId, query);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get(':membershipId')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ) {
    return this.teachersService.findOne(user.id, workspaceId, membershipId);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Patch(':membershipId/profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body(new ValidationPipe({ expectedType: UpdateTeacherProfileDto }))
    dto: UpdateTeacherProfileDto,
  ) {
    return this.teachersService.upsertProfile(user.id, workspaceId, membershipId, dto);
  }
}
