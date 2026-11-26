import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { PurchaseRequestsService } from './purchase-requests.service.js';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto.js';

@Controller('purchase-requests')
export class PurchaseRequestsController {
  constructor(private readonly purchaseRequestsService: PurchaseRequestsService, private readonly authService: AuthService) {}

  @Post()
  async create(@Req() request: Request, @Body() data: CreatePurchaseRequestDto) {
    const user = await this.getAuthenticatedUser(request, 'RESTAURANT');
    return this.purchaseRequestsService.create(user.id, data);
  }

  @Get('mine')
  async findMine(@Req() request: Request) {
    const user = await this.getAuthenticatedUser(request, 'RESTAURANT');
    return this.purchaseRequestsService.findMine(user.id);
  }

  @Get('received')
  async findReceived(@Req() request: Request) {
    const user = await this.getAuthenticatedUser(request, 'PRODUCER');
    return this.purchaseRequestsService.findReceived(user.id);
  }

  @Patch(':id/cancel')
  async cancel(@Req() request: Request, @Param('id') id: string) {
    const user = await this.getAuthenticatedUser(request, 'RESTAURANT');
    return this.purchaseRequestsService.cancel(user.id, id);
  }

  @Patch(':id/accept')
  async accept(@Req() request: Request, @Param('id') id: string) {
    const user = await this.getAuthenticatedUser(request, 'PRODUCER');
    return this.purchaseRequestsService.accept(user.id, id);
  }

  @Patch(':id/reject')
  async reject(@Req() request: Request, @Param('id') id: string) {
    const user = await this.getAuthenticatedUser(request, 'PRODUCER');
    return this.purchaseRequestsService.reject(user.id, id);
  }

  @Patch(':id/complete')
  async complete(@Req() request: Request, @Param('id') id: string) {
    const user = await this.getAuthenticatedUser(request, 'RESTAURANT');
    return this.purchaseRequestsService.complete(user.id, id);
  }

  private async getAuthenticatedUser(request: Request, requiredRole?: 'RESTAURANT' | 'PRODUCER') {
    const accessToken = request.cookies?.rekolta_access_token;
    if (typeof accessToken !== 'string' || !accessToken) throw new UnauthorizedException('You are not logged in.');
    const user = await this.authService.getCurrentUser(accessToken);
    if (user.role !== 'RESTAURANT' && user.role !== 'PRODUCER') throw new ForbiddenException('Only restaurant and producer accounts can access this feature.');
    if (requiredRole && user.role !== requiredRole) throw new ForbiddenException(`Only ${requiredRole.toLowerCase()} accounts can access this feature.`);
    return user;
  }
}
