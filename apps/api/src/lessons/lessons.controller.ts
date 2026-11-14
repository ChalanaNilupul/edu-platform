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
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { CreateMaterialDto } from './dto/create-material.dto.js';
import { ListLessonsQueryDto } from './dto/list-lessons.query.js';
import { ListWorkspaceLessonsQueryDto } from './dto/list-workspace-lessons.query.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { UpdateMaterialDto } from './dto/update-material.dto.js';
import { LessonsService } from './lessons.service.js';

@Controller('workspaces/:workspaceId')
@UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
export class LessonsController {
  constructor(@Inject(LessonsService) private readonly lessonsService: LessonsService) {}

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get('classes/:classId/lessons')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query(new ValidationPipe({ expectedType: ListLessonsQueryDto, transform: true }))
    query: ListLessonsQueryDto,
  ) {
    return this.lessonsService.list(user.id, workspaceId, classId, query);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Post('classes/:classId/lessons')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body(new ValidationPipe({ expectedType: CreateLessonDto })) dto: CreateLessonDto,
  ) {
    return this.lessonsService.create(user.id, workspaceId, classId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get('lessons')
  listForWorkspace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query(new ValidationPipe({ expectedType: ListWorkspaceLessonsQueryDto, transform: true }))
    query: ListWorkspaceLessonsQueryDto,
  ) {
    return this.lessonsService.listForWorkspace(user.id, workspaceId, query);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get('lessons/:lessonId')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ) {
    return this.lessonsService.findOne(user.id, workspaceId, lessonId);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Patch('lessons/:lessonId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body(new ValidationPipe({ expectedType: UpdateLessonDto })) dto: UpdateLessonDto,
  ) {
    return this.lessonsService.update(user.id, workspaceId, lessonId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Delete('lessons/:lessonId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ) {
    return this.lessonsService.remove(user.id, workspaceId, lessonId);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Post('lessons/:lessonId/materials')
  @HttpCode(HttpStatus.CREATED)
  addMaterial(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body(new ValidationPipe({ expectedType: CreateMaterialDto })) dto: CreateMaterialDto,
  ) {
    return this.lessonsService.addMaterial(user.id, workspaceId, lessonId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Patch('materials/:materialId')
  updateMaterial(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('materialId', ParseUUIDPipe) materialId: string,
    @Body(new ValidationPipe({ expectedType: UpdateMaterialDto })) dto: UpdateMaterialDto,
  ) {
    return this.lessonsService.updateMaterial(user.id, workspaceId, materialId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Delete('materials/:materialId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMaterial(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('materialId', ParseUUIDPipe) materialId: string,
  ) {
    return this.lessonsService.removeMaterial(user.id, workspaceId, materialId);
  }
}
