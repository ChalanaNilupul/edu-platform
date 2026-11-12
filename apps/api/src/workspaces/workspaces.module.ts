import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { MailModule } from '../mail/mail.module.js';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';
import { MembershipsService } from './memberships.service.js';
import { WorkspaceAccessService } from './workspace-access.service.js';
import { WorkspaceRolesGuard } from './workspace-roles.guard.js';
import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesService } from './workspaces.service.js';

@Module({
  imports: [AuthModule, MailModule],
  controllers: [WorkspacesController, InvitationsController],
  providers: [
    WorkspacesService,
    WorkspaceAccessService,
    MembershipsService,
    InvitationsService,
    WorkspaceRolesGuard,
  ],
  exports: [WorkspacesService, WorkspaceAccessService],
})
export class WorkspacesModule {}
