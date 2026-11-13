import {
  Body,
  Controller,
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
import { CreateStudentDto } from './dto/create-student.dto.js';
import { ImportStudentsDto } from './dto/import-students.dto.js';
import { ListStudentsQueryDto } from './dto/list-students.query.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { StudentsImportService } from './students-import.service.js';
import { StudentsService } from './students.service.js';

@Controller('workspaces/:workspaceId/students')
@UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
export class StudentsController {
  constructor(
    @Inject(StudentsService) private readonly studentsService: StudentsService,
    @Inject(StudentsImportService) private readonly studentsImportService: StudentsImportService,
  ) {}

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query(new ValidationPipe({ expectedType: ListStudentsQueryDto, transform: true }))
    query: ListStudentsQueryDto,
  ) {
    return this.studentsService.list(user.id, workspaceId, query);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get(':studentId')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.studentsService.findOne(user.id, workspaceId, studentId);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Post('import/validate')
  @HttpCode(HttpStatus.OK)
  validateImport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body(new ValidationPipe({ expectedType: ImportStudentsDto })) dto: ImportStudentsDto,
  ) {
    return this.studentsImportService.validate(user.id, workspaceId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Post('import')
  @HttpCode(HttpStatus.OK)
  import(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body(new ValidationPipe({ expectedType: ImportStudentsDto })) dto: ImportStudentsDto,
  ) {
    return this.studentsImportService.import(user.id, workspaceId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body(new ValidationPipe({ expectedType: CreateStudentDto })) dto: CreateStudentDto,
  ) {
    return this.studentsService.create(user.id, workspaceId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Patch(':studentId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body(new ValidationPipe({ expectedType: UpdateStudentDto })) dto: UpdateStudentDto,
  ) {
    return this.studentsService.update(user.id, workspaceId, studentId, dto);
  }
}
