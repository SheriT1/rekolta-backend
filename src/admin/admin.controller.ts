
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AdminService } from './admin.service.js';
import { AdminGuard } from './admin.guard.js';
import type { AdminRequest } from './admin.guard.js';

import {
  CreateCategoryDto,
  UpdateCategoryDto,
  UpdateProductVisibilityDto,
  UpdateReportDto,
  UpdateUserBlockDto,
} from './dto/admin.dto.js';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
  ) {}

  // DASHBOARD STATISTICS

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  // USER MANAGEMENT

  @Get('users')
  getUsers() {
    return this.adminService.getUsers();
  }

  @Patch('users/:id/block')
  updateUserBlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateUserBlockDto,
  ) {
    return this.adminService.updateUserBlock(
      id,
      data.isBlocked,
    );
  }

  // PRODUCT MODERATION

  @Get('products')
  getProducts() {
    return this.adminService.getProducts();
  }

  @Patch('products/:id/visibility')
  updateProductVisibility(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateProductVisibilityDto,
  ) {
    return this.adminService.updateProductVisibility(
      id,
      data.isHidden,
    );
  }

  // REPORT MANAGEMENT

  @Get('reports')
  getReports() {
    return this.adminService.getReports();
  }

  @Patch('reports/:id')
  updateReport(
    @Req() request: AdminRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateReportDto,
  ) {
    return this.adminService.updateReport(
      id,
      request.adminUser.id,
      data,
    );
  }

  // CATEGORY MANAGEMENT

  @Get('categories')
  getCategories() {
    return this.adminService.getCategories();
  }

  @Post('categories')
  createCategory(
    @Body() data: CreateCategoryDto,
  ) {
    return this.adminService.createCategory(data);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateCategoryDto,
  ) {
    return this.adminService.updateCategory(
      id,
      data,
    );
  }

  @Delete('categories/:id')
  deleteCategory(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.deleteCategory(id);
  }
}
