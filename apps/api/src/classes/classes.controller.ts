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
import { ClassesService } from './classes.service.js';
import { CreateClassDto } from './dto/create-class.dto.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { ListClassesQueryDto } from './dto/list-classes.query.js';
import { ListEnrollmentsQueryDto } from './dto/list-enrollments.query.js';
import { UpdateClassDto } from './dto/update-class.dto.js';
import { EnrollmentsService } from './enrollments.service.js';

@Controller('workspaces/:workspaceId/classes')
@UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
export class ClassesController {
  constructor(
    @Inject(ClassesService) private readonly classesService: ClassesService,
    @Inject(EnrollmentsService) private readonly enrollmentsService: EnrollmentsService,
  ) {}

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query(new ValidationPipe({ expectedType: ListClassesQueryDto, transform: true }))
    query: ListClassesQueryDto,
  ) {
    return this.classesService.list(user.id, workspaceId, query);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get(':classId')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.classesService.findOne(user.id, workspaceId, classId);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body(new ValidationPipe({ expectedType: CreateClassDto })) dto: CreateClassDto,
  ) {
    return this.classesService.create(user.id, workspaceId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Patch(':classId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body(new ValidationPipe({ expectedType: UpdateClassDto })) dto: UpdateClassDto,
  ) {
    return this.classesService.update(user.id, workspaceId, classId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Delete(':classId')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.classesService.remove(user.id, workspaceId, classId);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get(':classId/enrollments')
  listEnrollments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query(new ValidationPipe({ expectedType: ListEnrollmentsQueryDto, transform: true }))
    query: ListEnrollmentsQueryDto,
  ) {
    return this.enrollmentsService.listForClass(user.id, workspaceId, classId, query);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Post(':classId/enrollments')
  @HttpCode(HttpStatus.CREATED)
  enroll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body(new ValidationPipe({ expectedType: CreateEnrollmentDto })) dto: CreateEnrollmentDto,
  ) {
    return this.enrollmentsService.enroll(user.id, workspaceId, classId, dto);
  }
}
