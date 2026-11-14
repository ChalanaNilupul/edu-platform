import {
  Body,
  Controller,
  Delete,
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
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { CreateStudentFeeDto } from './dto/create-student-fee.dto.js';
import { ListStudentFeesQueryDto } from './dto/list-student-fees.query.js';
import { UpdateStudentFeeDto } from './dto/update-student-fee.dto.js';
import { PaymentsService } from './payments.service.js';
import { StudentFeesService } from './student-fees.service.js';

@Controller('workspaces/:workspaceId/finance/fees')
@UseGuards(SessionAuthGuard, WorkspaceRolesGuard)
export class StudentFeesController {
  constructor(
    @Inject(StudentFeesService) private readonly studentFeesService: StudentFeesService,
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService,
  ) {}

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query(new ValidationPipe({ expectedType: ListStudentFeesQueryDto, transform: true }))
    query: ListStudentFeesQueryDto,
  ) {
    return this.studentFeesService.list(user.id, workspaceId, query);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body(new ValidationPipe({ expectedType: CreateStudentFeeDto })) dto: CreateStudentFeeDto,
  ) {
    return this.studentFeesService.create(user.id, workspaceId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Get(':feeId')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('feeId', ParseUUIDPipe) feeId: string,
  ) {
    return this.studentFeesService.findOne(user.id, workspaceId, feeId);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Patch(':feeId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('feeId', ParseUUIDPipe) feeId: string,
    @Body(new ValidationPipe({ expectedType: UpdateStudentFeeDto })) dto: UpdateStudentFeeDto,
  ) {
    return this.studentFeesService.update(user.id, workspaceId, feeId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Post(':feeId/payments')
  @HttpCode(HttpStatus.CREATED)
  recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('feeId', ParseUUIDPipe) feeId: string,
    @Body(new ValidationPipe({ expectedType: CreatePaymentDto })) dto: CreatePaymentDto,
  ) {
    return this.paymentsService.record(user.id, workspaceId, feeId, dto);
  }

  @WorkspaceRoles(WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER)
  @Delete(':feeId/payments/:paymentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('feeId', ParseUUIDPipe) feeId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.paymentsService.remove(user.id, workspaceId, feeId, paymentId);
  }
}
