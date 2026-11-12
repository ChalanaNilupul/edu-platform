import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../common/types/authenticated-request.js';
import { AuthService } from './auth.service.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { SessionAuthGuard } from './session-auth.guard.js';

const FIVE_PER_MINUTE = { default: { limit: 5, ttl: 60_000 } };
const THREE_PER_MINUTE = { default: { limit: 3, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Throttle(FIVE_PER_MINUTE)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ expectedType: RegisterDto }))
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle(FIVE_PER_MINUTE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ expectedType: LoginDto }))
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { sessionToken, expiresAt, user } = await this.authService.login(dto);

    response.cookie('edu_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });

    return {
      message: 'Login successful',
      user,
    };
  }

  @UseGuards(SessionAuthGuard)
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return {
      user: request.user,
      activeWorkspaceId: request.activeWorkspaceId,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.logout(
      request.cookies?.edu_session as string | undefined,
    );

    response.clearCookie('edu_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return result;
  }

  @Throttle(FIVE_PER_MINUTE)
  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ expectedType: VerifyEmailDto }))
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Throttle(THREE_PER_MINUTE)
  @UseGuards(SessionAuthGuard)
  @Post('email/resend')
  @HttpCode(HttpStatus.OK)
  resendEmailVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.resendEmailVerification(user.id);
  }

  @Throttle(THREE_PER_MINUTE)
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ expectedType: ForgotPasswordDto }))
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Throttle(FIVE_PER_MINUTE)
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ expectedType: ResetPasswordDto }))
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }
}
