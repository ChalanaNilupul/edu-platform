import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { ClassScheduleController } from './class-schedule.controller.js';
import { ClassScheduleService } from './class-schedule.service.js';
import { ClassTeachersController } from './class-teachers.controller.js';
import { ClassTeachersService } from './class-teachers.service.js';
import { ClassesController } from './classes.controller.js';
import { ClassesService } from './classes.service.js';
import { EnrollmentsController } from './enrollments.controller.js';
import { EnrollmentsService } from './enrollments.service.js';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [
    ClassesController,
    EnrollmentsController,
    ClassTeachersController,
    ClassScheduleController,
    AttendanceController,
  ],
  providers: [
    ClassesService,
    EnrollmentsService,
    ClassTeachersService,
    ClassScheduleService,
    AttendanceService,
  ],
})
export class ClassesModule {}
