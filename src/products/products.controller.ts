
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

import { ProductsService } from './products.service.js';
import { AuthService } from '../auth/auth.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly authService: AuthService,
  ) {}

  // PUBLIC: Get available products
  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  // PRODUCER: Get own product listings
  @Get('mine')
  async findMine(@Req() request: Request) {
    const user = await this.getAuthenticatedProducer(request);

    return this.productsService.findMine(user.id);
  }

  // PRODUCER: Create a new product
  @Post()
  async create(
    @Req() request: Request,
    @Body() data: CreateProductDto,
  ) {
    const user = await this.getAuthenticatedProducer(request);

    return this.productsService.create(user.id, data);
  }

  // Verify the logged-in user is a producer
  private async getAuthenticatedProducer(request: Request) {
    const accessToken = request.cookies?.rekolta_access_token;

    if (typeof accessToken !== 'string' || !accessToken) {
      throw new UnauthorizedException('You are not logged in.');
    }

    const user = await this.authService.getCurrentUser(accessToken);

    if (user.role !== 'PRODUCER') {
      throw new ForbiddenException(
        'Only producers can manage product listings.',
      );
    }

    return user;
  }
}
