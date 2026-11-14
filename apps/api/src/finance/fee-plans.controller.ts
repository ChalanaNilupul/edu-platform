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
import { CreateFeePlanDto } from './dto/create-fee-plan.dto.js';
import { GenerateStudentFeesDto } from './dto/generate-student-fees.dto.js';
import { ListFeePlansQueryDto } from './dto/list-fee-plans.query.js';
import { UpdateFeePlanDto } from './dto/update-fee-plan.dto.js';
import { FeePlansService } from './fee-plans.service.js';

@Controller('workspaces/:workspaceId/finance/plans')
@UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
export class FeePlansController {
  constructor(@Inject(FeePlansService) private readonly feePlansService: FeePlansService) {}

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query(new ValidationPipe({ expectedType: ListFeePlansQueryDto, transform: true }))
    query: ListFeePlansQueryDto,
  ) {
    return this.feePlansService.list(user.id, workspaceId, query);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body(new ValidationPipe({ expectedType: CreateFeePlanDto })) dto: CreateFeePlanDto,
  ) {
    return this.feePlansService.create(user.id, workspaceId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Get(':planId')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
  ) {
    return this.feePlansService.findOne(user.id, workspaceId, planId);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Patch(':planId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body(new ValidationPipe({ expectedType: UpdateFeePlanDto })) dto: UpdateFeePlanDto,
  ) {
    return this.feePlansService.update(user.id, workspaceId, planId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Post(':planId/generate')
  @HttpCode(HttpStatus.CREATED)
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body(new ValidationPipe({ expectedType: GenerateStudentFeesDto })) dto: GenerateStudentFeesDto,
  ) {
    return this.feePlansService.generate(user.id, workspaceId, planId, dto);
  }
}
