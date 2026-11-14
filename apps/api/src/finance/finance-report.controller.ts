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
import { FinanceReportQueryDto } from './dto/finance-report.query.js';
import { FinanceReportService } from './finance-report.service.js';

@Controller('workspaces/:workspaceId/finance/reports')
@UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
export class FinanceReportController {
  constructor(@Inject(FinanceReportService) private readonly reportService: FinanceReportService) {}

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Get('monthly')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query(new ValidationPipe({ expectedType: FinanceReportQueryDto, transform: true }))
    query: FinanceReportQueryDto,
  ) {
    return this.reportService.get(user.id, workspaceId, query);
  }
}
