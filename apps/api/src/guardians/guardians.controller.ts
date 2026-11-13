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

import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-request.js';
import { WorkspaceRole } from '../generated/prisma/client.js';
import { WorkspaceRoles } from '../workspaces/workspace-roles.decorator.js';
import { WorkspaceRolesGuard } from '../workspaces/workspace-roles.guard.js';
import { CreateGuardianDto } from './dto/create-guardian.dto.js';
import { UpdateGuardianDto } from './dto/update-guardian.dto.js';
import { GuardiansService } from './guardians.service.js';

@Controller('workspaces/:workspaceId')
@UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
export class GuardiansController {
  constructor(@Inject(GuardiansService) private readonly guardiansService: GuardiansService) {}

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get('students/:studentId/guardians')
  listForStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.guardiansService.listForStudent(user.id, workspaceId, studentId);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Post('students/:studentId/guardians')
  @HttpCode(HttpStatus.CREATED)
  createForStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body(new ValidationPipe({ expectedType: CreateGuardianDto })) dto: CreateGuardianDto,
  ) {
    return this.guardiansService.createForStudent(user.id, workspaceId, studentId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Delete('students/:studentId/guardians/:guardianId')
  unlink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('guardianId', ParseUUIDPipe) guardianId: string,
  ) {
    return this.guardiansService.unlink(user.id, workspaceId, studentId, guardianId);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get('guardians/:guardianId')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('guardianId', ParseUUIDPipe) guardianId: string,
  ) {
    return this.guardiansService.findOne(user.id, workspaceId, guardianId);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Patch('guardians/:guardianId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('guardianId', ParseUUIDPipe) guardianId: string,
    @Body(new ValidationPipe({ expectedType: UpdateGuardianDto })) dto: UpdateGuardianDto,
  ) {
    return this.guardiansService.update(user.id, workspaceId, guardianId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Delete('guardians/:guardianId')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('guardianId', ParseUUIDPipe) guardianId: string,
  ) {
    return this.guardiansService.remove(user.id, workspaceId, guardianId);
  }
}
