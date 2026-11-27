import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import type { Request } from 'express';

import { AuthService } from '../auth/auth.service.js';
import { RecommendationsService } from './recommendations.service.js';
import { GetRecommendationsDto } from './dto/get-recommendations.dto.js';

@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async getRecommendations(
    @Req() request: Request,
    @Query() data: GetRecommendationsDto,
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
        'Only restaurant accounts can request recommendations.',
      );
    }

    return this.recommendationsService.getRecommendations(
      user.id,
      data.categoryId,
      data.productName,
      data.unit,
      data.quantity,
    );
  }
}