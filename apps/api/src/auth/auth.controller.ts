import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';

import { AuthService } from './auth.service.js';
import type { RegisterDto } from './dto/register.dto.js';

import { Res, UsePipes, ValidationPipe } from '@nestjs/common';
import type { Response } from 'express';

// Keep LoginDto as a runtime import for validation.
import { LoginDto } from './dto/login.dto.js';

import { Get, Req } from '@nestjs/common';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
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
    const cookieHeader = request.headers.cookie;

    const sessionToken = cookieHeader
      ?.split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith('edu_session='))
      ?.slice('edu_session='.length);

    return this.authService.getCurrentUser(sessionToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const sessionToken = request.headers.cookie
      ?.split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith('edu_session='))
      ?.slice('edu_session='.length);

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
