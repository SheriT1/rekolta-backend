import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from '../auth/auth.service.js';
import { FulfilmentArrangementsService } from './fulfilment-arrangements.service.js';
import { CreateFulfilmentArrangementDto } from './dto/create-fulfilment-arrangement.dto.js';
import { CreateCounterproposalDto } from './dto/create-counterproposal.dto.js';

@Controller('fulfilment-arrangements')
export class FulfilmentArrangementsController {
  constructor(
    private readonly fulfilmentArrangementsService:
      FulfilmentArrangementsService,
    private readonly authService: AuthService,
  ) {}

  // RESTAURANT: Propose pickup or delivery
  @Post()
  async create(
    @Req() request: Request,
    @Body() data: CreateFulfilmentArrangementDto,
  ) {
    const user = await this.getAuthenticatedUser(
      request,
      'RESTAURANT',
    );

    return this.fulfilmentArrangementsService.create(
      user.id,
      data,
    );
  }

  // RESTAURANT / PRODUCER: View arrangement for an order
  @Get('request/:requestId')
  async findByRequest(
    @Req() request: Request,
    @Param('requestId') requestId: string,
  ) {
    const user = await this.getAuthenticatedUser(request);

    return this.fulfilmentArrangementsService.findByRequest(
      user.id,
      requestId,
    );
  }

  // PRODUCER: Confirm pickup or delivery
  @Patch(':id/confirm')
  async confirm(
    @Req() request: Request,
    @Param('id') arrangementId: string,
  ) {
    const user = await this.getAuthenticatedUser(
      request,
      'PRODUCER',
    );

    return this.fulfilmentArrangementsService.confirm(
      user.id,
      arrangementId,
    );
  }

  // PRODUCER: Decline pickup or delivery
  @Patch(':id/decline')
  async decline(
    @Req() request: Request,
    @Param('id') arrangementId: string,
  ) {
    const user = await this.getAuthenticatedUser(
      request,
      'PRODUCER',
    );

    return this.fulfilmentArrangementsService.decline(
      user.id,
      arrangementId,
    );
  }

  // PRODUCER: Suggest an alternative arrangement
  @Patch(':id/counterproposal')
  async counterproposal(
    @Req() request: Request,
    @Param('id') arrangementId: string,
    @Body() data: CreateCounterproposalDto,
  ) {
    const user = await this.getAuthenticatedUser(
      request,
      'PRODUCER',
    );

    return this.fulfilmentArrangementsService.counterproposal(
      user.id,
      arrangementId,
      data,
    );
  }

  // Authenticate user and optionally verify their role
  private async getAuthenticatedUser(
    request: Request,
    requiredRole?: 'RESTAURANT' | 'PRODUCER',
  ) {
    const accessToken =
      request.cookies?.rekolta_access_token;

    if (
      typeof accessToken !== 'string' ||
      !accessToken
    ) {
      throw new UnauthorizedException(
        'You are not logged in.',
      );
    }

    const user =
      await this.authService.getCurrentUser(accessToken);

    if (
      user.role !== 'RESTAURANT' &&
      user.role !== 'PRODUCER'
    ) {
      throw new ForbiddenException(
        'Only restaurant and producer accounts can access this feature.',
      );
    }

    if (requiredRole && user.role !== requiredRole) {
      throw new ForbiddenException(
        `Only ${requiredRole.toLowerCase()} accounts can access this feature.`,
      );
    }

    return user;
  }
}
