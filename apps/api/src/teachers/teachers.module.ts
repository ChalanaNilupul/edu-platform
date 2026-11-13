import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { TeachersController } from './teachers.controller.js';
import { TeachersService } from './teachers.service.js';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [TeachersController],
  providers: [TeachersService],
})
export class TeachersModule {}
