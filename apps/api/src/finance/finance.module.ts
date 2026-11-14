import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { FeePlansController } from './fee-plans.controller.js';
import { FeePlansService } from './fee-plans.service.js';
import { FinanceOverviewController } from './finance-overview.controller.js';
import { FinanceOverviewService } from './finance-overview.service.js';
import { FinanceReportController } from './finance-report.controller.js';
import { FinanceReportService } from './finance-report.service.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { StudentFeesController } from './student-fees.controller.js';
import { StudentFeesService } from './student-fees.service.js';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [
    FeePlansController,
    StudentFeesController,
    FinanceOverviewController,
    FinanceReportController,
    PaymentsController,
  ],
  providers: [
    FeePlansService,
    StudentFeesService,
    PaymentsService,
    FinanceOverviewService,
    FinanceReportService,
  ],
})
export class FinanceModule {}
