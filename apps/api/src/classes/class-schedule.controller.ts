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
import { ClassScheduleService } from './class-schedule.service.js';
import { CreateClassScheduleSlotDto } from './dto/create-class-schedule-slot.dto.js';
import { UpdateClassScheduleSlotDto } from './dto/update-class-schedule-slot.dto.js';

@Controller('workspaces/:workspaceId')
@UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
export class ClassScheduleController {
  constructor(
    @Inject(ClassScheduleService) private readonly classScheduleService: ClassScheduleService,
  ) {}

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER)
  @Get('classes/:classId/schedule')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.classScheduleService.listForClass(user.id, workspaceId, classId);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Post('classes/:classId/schedule')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body(new ValidationPipe({ expectedType: CreateClassScheduleSlotDto }))
    dto: CreateClassScheduleSlotDto,
  ) {
    return this.classScheduleService.create(user.id, workspaceId, classId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Patch('classes/:classId/schedule/:slotId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('slotId', ParseUUIDPipe) slotId: string,
    @Body(new ValidationPipe({ expectedType: UpdateClassScheduleSlotDto }))
    dto: UpdateClassScheduleSlotDto,
  ) {
    return this.classScheduleService.update(user.id, workspaceId, classId, slotId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Delete('classes/:classId/schedule/:slotId')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('slotId', ParseUUIDPipe) slotId: string,
  ) {
    return this.classScheduleService.remove(user.id, workspaceId, classId, slotId);
  }
}
