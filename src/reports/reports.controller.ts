import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import type { Request } from 'express';

import { AuthService } from '../auth/auth.service.js';
import { ReportsService } from './reports.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  async create(
    @Req() request: Request,
    @Body() data: CreateReportDto,
  ) {
    const accessToken =
      request.cookies?.rekolta_access_token;

    if (typeof accessToken !== 'string' || !accessToken) {
      throw new UnauthorizedException(
        'You are not logged in.',
      );
    }

    const user =
      await this.authService.getCurrentUser(accessToken);

    if (user.role !== 'RESTAURANT') {
      throw new ForbiddenException(
        'Only restaurant accounts can report product listings.',
      );
    }

    return this.reportsService.create(user.id, data);
  }
}