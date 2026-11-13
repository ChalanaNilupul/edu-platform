import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { GuardiansController } from './guardians.controller.js';
import { GuardiansService } from './guardians.service.js';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [GuardiansController],
  providers: [GuardiansService],
})
export class GuardiansModule {}
