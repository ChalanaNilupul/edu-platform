import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
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
import { FinanceOverviewQueryDto } from './dto/finance-overview.query.js';
import { FinanceOverviewService } from './finance-overview.service.js';

@Controller('workspaces/:workspaceId/finance')
@UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
export class FinanceOverviewController {
  constructor(
    @Inject(FinanceOverviewService) private readonly overviewService: FinanceOverviewService,
  ) {}

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Get('overview')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query(new ValidationPipe({ expectedType: FinanceOverviewQueryDto, transform: true }))
    query: FinanceOverviewQueryDto,
  ) {
    return this.overviewService.get(user.id, workspaceId, query);
  }
}
