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
import { ClassTeachersService } from './class-teachers.service.js';
import { AssignClassTeacherDto } from './dto/assign-class-teacher.dto.js';
import { ListClassTeachersQueryDto } from './dto/list-class-teachers.query.js';
import { UpdateClassTeacherDto } from './dto/update-class-teacher.dto.js';

@Controller('workspaces/:workspaceId')
@UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
export class ClassTeachersController {
  constructor(
    @Inject(ClassTeachersService) private readonly classTeachersService: ClassTeachersService,
  ) {}

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get('classes/:classId/teachers')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query(new ValidationPipe({ expectedType: ListClassTeachersQueryDto, transform: true }))
    query: ListClassTeachersQueryDto,
  ) {
    return this.classTeachersService.listForClass(user.id, workspaceId, classId, query);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Post('classes/:classId/teachers')
  @HttpCode(HttpStatus.CREATED)
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body(new ValidationPipe({ expectedType: AssignClassTeacherDto }))
    dto: AssignClassTeacherDto,
  ) {
    return this.classTeachersService.assign(user.id, workspaceId, classId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Patch('classes/:classId/teachers/:assignmentId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body(new ValidationPipe({ expectedType: UpdateClassTeacherDto }))
    dto: UpdateClassTeacherDto,
  ) {
    return this.classTeachersService.update(user.id, workspaceId, classId, assignmentId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Delete('classes/:classId/teachers/:assignmentId')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.classTeachersService.remove(user.id, workspaceId, classId, assignmentId);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get('teachers/:membershipId/classes')
  listForTeacher(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ) {
    return this.classTeachersService.listForTeacher(user.id, workspaceId, membershipId);
  }
}
