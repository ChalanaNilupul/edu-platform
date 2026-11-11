import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';

import { Res, UsePipes, ValidationPipe } from '@nestjs/common';
import type { Response } from 'express';

// Keep LoginDto as a runtime import for validation.
import { LoginDto } from './dto/login.dto.js';

import { Get, Req } from '@nestjs/common';
import type { Request } from 'express';

import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UseGuards } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ expectedType: RegisterDto }))
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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

  @Get('me')
  async me(@Req() request: Request) {
    const sessionToken = request.cookies?.edu_session as string | undefined;

    return this.authService.getCurrentUser(sessionToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const sessionToken = request.cookies?.edu_session as string | undefined;

    const result = await this.authService.logout(sessionToken);

    response.clearCookie('edu_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return result;
  }
}
