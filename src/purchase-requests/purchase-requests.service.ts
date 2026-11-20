
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto.js';

@Injectable()
export class PurchaseRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  // RESTAURANT: Submit a purchase request
  async create(userId: string, data: CreatePurchaseRequestDto) {
    const restaurant = await this.prisma.restaurant_profiles.findUnique({
      where: { user_id: userId },
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurant profile not found.');
    }

    const product = await this.prisma.product_listings.findFirst({
      where: {
        id: data.productListingId,
        is_active: true,
        is_hidden: false,
      },
    });

    if (!product) {
      throw new NotFoundException('Product is not available.');
    }

    if (
      data.requestedQuantity <= 0 ||
      data.requestedQuantity > product.available_quantity.toNumber()
    ) {
      throw new BadRequestException(
        'Requested quantity exceeds the available quantity.',
      );
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (
      product.available_from > today ||
      product.available_until < today
    ) {
      throw new BadRequestException(
        'This product is outside its availability period.',
      );
    }

    return this.prisma.purchase_requests.create({
      data: {
        restaurant_id: restaurant.id,
        product_listing_id: product.id,
        requested_quantity: data.requestedQuantity,
        unit_price: product.price,
        status: 'SUBMITTED',
      },
    });
  }

  // RESTAURANT: View own purchase requests
  async findMine(userId: string) {
    const restaurant = await this.prisma.restaurant_profiles.findUnique({
      where: { user_id: userId },
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurant profile not found.');
    }

    return this.prisma.purchase_requests.findMany({
      where: { restaurant_id: restaurant.id },
      include: {
        product_listings: {
          select: {
            id: true,
            name: true,
            unit: true,
            producer_profiles: {
              select: {
                business_name: true,
                city: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  // PRODUCER: View incoming purchase requests
  async findReceived(userId: string) {
    const producer = await this.prisma.producer_profiles.findUnique({
      where: { user_id: userId },
    });

    if (!producer) {
      throw new NotFoundException('Producer profile not found.');
    }

    return this.prisma.purchase_requests.findMany({
      where: {
        product_listings: {
          producer_id: producer.id,
        },
      },
      include: {
        product_listings: {
          select: {
            id: true,
            name: true,
            unit: true,
          },
        },
        restaurant_profiles: {
          select: {
            restaurant_name: true,
            city: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }
}
