import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';

import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { CurrentSessionId, CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-request.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { InvitationsService } from './invitations.service.js';

@Controller('invitations')
export class InvitationsController {
  constructor(
    @Inject(InvitationsService) private readonly invitationsService: InvitationsService,
  ) {}

  @UseGuards(SessionAuthGuard)
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSessionId() sessionId: string,
    @Body(new ValidationPipe({ expectedType: AcceptInvitationDto })) dto: AcceptInvitationDto,
  ) {
    return this.invitationsService.accept(user.id, user.email, sessionId, dto.token);
  }
}
