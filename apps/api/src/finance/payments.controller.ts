import { Controller, Get, Inject, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';

import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-request.js';
import { WorkspaceRole } from '../generated/prisma/client.js';
import { WorkspaceRoles } from '../workspaces/workspace-roles.decorator.js';
import { WorkspaceRolesGuard } from '../workspaces/workspace-roles.guard.js';
import { PaymentsService } from './payments.service.js';

@Controller('workspaces/:workspaceId/finance/payments')
@UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Get(':paymentId/receipt')
  getReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.paymentsService.getReceipt(user.id, workspaceId, paymentId);
  }
}
