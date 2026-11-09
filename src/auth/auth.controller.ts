
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  // REGISTER
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() data: RegisterDto) {
    return this.authService.register(data);
  }

  // LOGIN
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() data: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(data);

    response.cookie('rekolta_access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000,
      path: '/',
    });

    return {
      message: result.message,
      user: result.user,
    };
  }

  // GET CURRENT LOGGED-IN USER
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getMe(@Req() request: Request) {
    const accessToken = request.cookies?.rekolta_access_token;

    if (typeof accessToken !== 'string' || !accessToken) {
      throw new UnauthorizedException(
        'You are not logged in.',
      );
    }

    const user = await this.authService.getCurrentUser(
      accessToken,
    );

    return {
      user,
    };
  }

  // LOGOUT
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(
    @Res({ passthrough: true }) response: Response,
  ) {
    response.clearCookie('rekolta_access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return {
      message: 'Logged out successfully.',
    };
  }
}

