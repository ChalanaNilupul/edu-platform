import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Put,
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
import { AttendanceService } from './attendance.service.js';
import { GetAttendanceSummaryQueryDto } from './dto/get-attendance-summary.query.js';
import { GetAttendanceQueryDto } from './dto/get-attendance.query.js';
import { SaveAttendanceDto } from './dto/save-attendance.dto.js';

@Controller('workspaces/:workspaceId')
@UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
export class AttendanceController {
  constructor(@Inject(AttendanceService) private readonly attendanceService: AttendanceService) {}

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get('classes/:classId/attendance')
  getRegister(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query(new ValidationPipe({ expectedType: GetAttendanceQueryDto, transform: true }))
    query: GetAttendanceQueryDto,
  ) {
    return this.attendanceService.getRegister(user.id, workspaceId, classId, query.date);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get('classes/:classId/attendance/summary')
  getClassSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query(new ValidationPipe({ expectedType: GetAttendanceSummaryQueryDto, transform: true }))
    query: GetAttendanceSummaryQueryDto,
  ) {
    return this.attendanceService.getClassSummary(
      user.id,
      workspaceId,
      classId,
      query.from,
      query.to,
    );
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get('students/:studentId/attendance/summary')
  getStudentSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Query(new ValidationPipe({ expectedType: GetAttendanceSummaryQueryDto, transform: true }))
    query: GetAttendanceSummaryQueryDto,
  ) {
    return this.attendanceService.getStudentSummary(
      user.id,
      workspaceId,
      studentId,
      query.from,
      query.to,
    );
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Put('classes/:classId/attendance')
  saveRegister(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body(new ValidationPipe({ expectedType: SaveAttendanceDto }))
    dto: SaveAttendanceDto,
  ) {
    return this.attendanceService.saveRegister(user.id, workspaceId, classId, dto);
  }
}
