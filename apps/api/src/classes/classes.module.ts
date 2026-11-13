import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { ClassesController } from './classes.controller.js';
import { ClassesService } from './classes.service.js';
import { EnrollmentsController } from './enrollments.controller.js';
import { EnrollmentsService } from './enrollments.service.js';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [ClassesController, EnrollmentsController],
  providers: [ClassesService, EnrollmentsService],
})
export class ClassesModule {}
