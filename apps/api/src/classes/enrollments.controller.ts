import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';

import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-request.js';
import { WorkspaceRole } from '../generated/prisma/client.js';
import { WorkspaceRoles } from '../workspaces/workspace-roles.decorator.js';
import { WorkspaceRolesGuard } from '../workspaces/workspace-roles.guard.js';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto.js';
import { EnrollmentsService } from './enrollments.service.js';

@Controller('workspaces/:workspaceId')
@UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
export class EnrollmentsController {
  constructor(
    @Inject(EnrollmentsService) private readonly enrollmentsService: EnrollmentsService,
  ) {}

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get('students/:studentId/enrollments')
  listForStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.enrollmentsService.listForStudent(user.id, workspaceId, studentId);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Patch('enrollments/:enrollmentId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body(new ValidationPipe({ expectedType: UpdateEnrollmentDto })) dto: UpdateEnrollmentDto,
  ) {
    return this.enrollmentsService.update(user.id, workspaceId, enrollmentId, dto);
  }
}
