import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { FavoritesService } from './favorites.service.js';

@Controller('favorites')
export class FavoritesController {
  constructor(
    private readonly favoritesService: FavoritesService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async findAll(@Req() request: Request) {
    const user = await this.getRestaurantUser(request);

    return this.favoritesService.findAll(user.id);
  }

  @Post(':productId')
  async add(
    @Req() request: Request,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    const user = await this.getRestaurantUser(request);

    return this.favoritesService.add(user.id, productId);
  }

  @Delete(':productId')
  async remove(
    @Req() request: Request,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    const user = await this.getRestaurantUser(request);

    return this.favoritesService.remove(user.id, productId);
  }

  private async getRestaurantUser(request: Request) {
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

    if (user.role !== 'RESTAURANT') {
      throw new ForbiddenException(
        'Only restaurant accounts can manage favorites.',
      );
    }

    return user;
  }
}