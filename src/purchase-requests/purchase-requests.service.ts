import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto.js';

@Injectable()
export class PurchaseRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  private async restaurant(userId: string) {
    const profile = await this.prisma.restaurant_profiles.findUnique({ where: { user_id: userId } });
    if (!profile) throw new NotFoundException('Restaurant profile not found.');
    return profile;
  }
  private async producer(userId: string) {
    const profile = await this.prisma.producer_profiles.findUnique({ where: { user_id: userId } });
    if (!profile) throw new NotFoundException('Producer profile not found.');
    return profile;
  }
  async create(userId: string, data: CreatePurchaseRequestDto) {
    const restaurant = await this.restaurant(userId);
    const product = await this.prisma.product_listings.findFirst({ where: { id: data.productListingId, is_active: true, is_hidden: false } });
    if (!product) throw new NotFoundException('Product is not available.');
    if (data.requestedQuantity <= 0 || data.requestedQuantity > product.available_quantity.toNumber()) throw new BadRequestException('Requested quantity exceeds the available quantity.');
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    if (product.available_from > today || product.available_until < today) throw new BadRequestException('This product is outside its availability period.');
    return this.prisma.purchase_requests.create({ data: { restaurant_id: restaurant.id, product_listing_id: product.id, requested_quantity: data.requestedQuantity, unit_price: product.price, status: 'SUBMITTED' } });
  }
  async cancel(userId: string, requestId: string) {
    const restaurant = await this.restaurant(userId);
    return this.prisma.$transaction(async tx => {
      const order = await tx.purchase_requests.findFirst({ where: { id: requestId, restaurant_id: restaurant.id }, include: { fulfilment_arrangements: true } });
      if (!order) throw new NotFoundException('Purchase request not found.');
      if (order.status !== 'SUBMITTED' && order.status !== 'ACCEPTED') throw new BadRequestException('Only submitted or accepted requests can be cancelled.');
      if (order.fulfilment_arrangements?.status === 'CONFIRMED') throw new BadRequestException('A purchase request with a confirmed arrangement cannot be cancelled.');
      const result = await tx.purchase_requests.updateMany({ where: { id: requestId, restaurant_id: restaurant.id, status: order.status }, data: { status: 'CANCELLED', updated_at: new Date() } });
      if (!result.count) throw new BadRequestException('This purchase request can no longer be cancelled.');
      if (order.status === 'ACCEPTED') await tx.product_listings.update({ where: { id: order.product_listing_id }, data: { available_quantity: { increment: order.requested_quantity } } });
      await tx.fulfilment_arrangements.updateMany({ where: { purchase_request_id: requestId, status: { in: ['PENDING', 'DECLINED', 'COUNTERPROPOSED'] } }, data: { status: 'CANCELLED', updated_at: new Date() } });
      return tx.purchase_requests.findUnique({ where: { id: requestId } });
    });
  }
  async accept(userId: string, requestId: string) {
    const producer = await this.producer(userId);
    return this.prisma.$transaction(async tx => {
      const order = await tx.purchase_requests.findFirst({ where: { id: requestId, product_listings: { producer_id: producer.id } } });
      if (!order) throw new NotFoundException('Purchase request not found.');
      if (order.status !== 'SUBMITTED') throw new BadRequestException('Only pending purchase requests can be accepted.');
      // Lock order before inventory, consistently with cancellation.
      const result = await tx.purchase_requests.updateMany({ where: { id: requestId, status: 'SUBMITTED', product_listings: { producer_id: producer.id } }, data: { status: 'ACCEPTED', updated_at: new Date() } });
      if (!result.count) throw new BadRequestException('This purchase request can no longer be accepted.');
      const stock = await tx.product_listings.updateMany({ where: { id: order.product_listing_id, producer_id: producer.id, available_quantity: { gte: order.requested_quantity } }, data: { available_quantity: { decrement: order.requested_quantity } } });
      if (!stock.count) throw new BadRequestException('Insufficient available quantity to accept this request.');
      return tx.purchase_requests.findUnique({ where: { id: requestId } });
    });
  }
  async reject(userId: string, requestId: string) {
    const producer = await this.producer(userId);
    const order = await this.prisma.purchase_requests.findFirst({ where: { id: requestId, product_listings: { producer_id: producer.id } } });
    if (!order) throw new NotFoundException('Purchase request not found.');
    if (order.status !== 'SUBMITTED') throw new BadRequestException('Only pending purchase requests can be rejected.');
    const result = await this.prisma.purchase_requests.updateMany({ where: { id: requestId, status: 'SUBMITTED', product_listings: { producer_id: producer.id } }, data: { status: 'REJECTED', updated_at: new Date() } });
    if (!result.count) throw new BadRequestException('This purchase request can no longer be rejected.');
    return this.prisma.purchase_requests.findUnique({ where: { id: requestId } });
  }
  async complete(userId: string, requestId: string) {
    const restaurant = await this.restaurant(userId);
    return this.prisma.$transaction(async tx => {
      const order = await tx.purchase_requests.findFirst({ where: { id: requestId, restaurant_id: restaurant.id }, include: { fulfilment_arrangements: true } });
      if (!order) throw new NotFoundException('Purchase request not found.');
      if (order.status !== 'ARRANGED' || order.fulfilment_arrangements?.status !== 'CONFIRMED') throw new BadRequestException('Only arranged orders with confirmed fulfilment can be completed.');
      const result = await tx.purchase_requests.updateMany({ where: { id: requestId, restaurant_id: restaurant.id, status: 'ARRANGED' }, data: { status: 'COMPLETED', updated_at: new Date() } });
      if (!result.count) throw new BadRequestException('This purchase request can no longer be completed.');
      return tx.purchase_requests.findUnique({ where: { id: requestId } });
    });
  }
  async findMine(userId: string) {
    const restaurant = await this.restaurant(userId);
    return this.prisma.purchase_requests.findMany({ where: { restaurant_id: restaurant.id }, include: { product_listings: { select: { id: true, name: true, unit: true, producer_profiles: { select: { business_name: true, city: true } } } } }, orderBy: { created_at: 'desc' } });
  }
  async findReceived(userId: string) {
    const producer = await this.producer(userId);
    return this.prisma.purchase_requests.findMany({ where: { product_listings: { producer_id: producer.id } }, include: { product_listings: { select: { id: true, name: true, unit: true } }, restaurant_profiles: { select: { restaurant_name: true, city: true } } }, orderBy: { created_at: 'desc' } });
  }
}
