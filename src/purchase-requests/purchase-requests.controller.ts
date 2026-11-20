
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from '../auth/auth.service.js';
import { PurchaseRequestsService } from './purchase-requests.service.js';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto.js';

@Controller('purchase-requests')
export class PurchaseRequestsController {
  constructor(
    private readonly purchaseRequestsService: PurchaseRequestsService,
    private readonly authService: AuthService,
  ) {}

  // RESTAURANT: Submit a purchase request
  @Post()
  async create(
    @Req() request: Request,
    @Body() data: CreatePurchaseRequestDto,
  ) {
    const user = await this.getAuthenticatedUser(
      request,
      'RESTAURANT',
    );

    return this.purchaseRequestsService.create(user.id, data);
  }

  // RESTAURANT: View own purchase requests
  @Get('mine')
  async findMine(@Req() request: Request) {
    const user = await this.getAuthenticatedUser(
      request,
      'RESTAURANT',
    );

    return this.purchaseRequestsService.findMine(user.id);
  }

  // PRODUCER: View incoming purchase requests
  @Get('received')
  async findReceived(@Req() request: Request) {
    const user = await this.getAuthenticatedUser(
      request,
      'PRODUCER',
    );

    return this.purchaseRequestsService.findReceived(user.id);
  }

  private async getAuthenticatedUser(
    request: Request,
    requiredRole: 'RESTAURANT' | 'PRODUCER',
  ) {
    const accessToken = request.cookies?.rekolta_access_token;

    if (typeof accessToken !== 'string' || !accessToken) {
      throw new UnauthorizedException('You are not logged in.');
    }

    const user = await this.authService.getCurrentUser(accessToken);

    if (user.role !== requiredRole) {
      throw new ForbiddenException(
        `Only ${requiredRole.toLowerCase()} accounts can access this feature.`,
      );
    }

    return user;
  }
}

