import {
  Body, Controller, Delete, ForbiddenException, Get, Param,
  ParseUUIDPipe, Patch, Post, Req, UnauthorizedException,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { ProductsService } from './products.service.js';
import { AuthService } from '../auth/auth.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get('mine')
  async findMine(@Req() request: Request) {
    const user = await this.getAuthenticatedProducer(request);
    return this.productsService.findMine(user.id);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) productId: string) {
    return this.productsService.findOne(productId);
  }

  @Post()
  async create(@Req() request: Request, @Body() data: CreateProductDto) {
    const user = await this.getAuthenticatedProducer(request);
    return this.productsService.create(user.id, data);
  }

  @Patch(':id')
  async update(
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe()) productId: string,
    @Body() data: UpdateProductDto,
  ) {
    const user = await this.getAuthenticatedProducer(request);
    return this.productsService.update(user.id, productId, data);
  }

  @Delete(':id')
  async remove(
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe()) productId: string,
  ) {
    const user = await this.getAuthenticatedProducer(request);
    return this.productsService.remove(user.id, productId);
  }

  @Post(':id/images')
  @UseInterceptors(FileInterceptor('image', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  }))
  async uploadImage(
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe()) productId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const user = await this.getAuthenticatedProducer(request);
    return this.productsService.uploadImage(user.id, productId, file);
  }

  @Delete(':id/images/:imageId')
  async removeImage(
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe()) productId: string,
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
  ) {
    const user = await this.getAuthenticatedProducer(request);
    return this.productsService.removeImage(user.id, productId, imageId);
  }

  private async getAuthenticatedProducer(request: Request) {
    const accessToken = request.cookies?.rekolta_access_token;
    if (typeof accessToken !== 'string' || !accessToken) {
      throw new UnauthorizedException('You are not logged in.');
    }
    const user = await this.authService.getCurrentUser(accessToken);
    if (user.role !== 'PRODUCER') {
      throw new ForbiddenException('Only producers can manage product listings.');
    }
    return user;
  }
}
