
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

  // RESTAURANT: Cancel own submitted or accepted purchase request
  async cancel(userId: string, requestId: string) {
    const restaurant =
      await this.prisma.restaurant_profiles.findUnique({
        where: { user_id: userId },
      });

    if (!restaurant) {
      throw new NotFoundException(
        'Restaurant profile not found.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const purchaseRequest =
        await tx.purchase_requests.findFirst({
          where: {
            id: requestId,
            restaurant_id: restaurant.id,
          },
          include: {
            fulfilment_arrangements: true,
          },
        });

      if (!purchaseRequest) {
        throw new NotFoundException(
          'Purchase request not found.',
        );
      }

      if (
        purchaseRequest.status !== 'SUBMITTED' &&
        purchaseRequest.status !== 'ACCEPTED'
      ) {
        throw new BadRequestException(
          'Only submitted or accepted requests can be cancelled.',
        );
      }

      if (
        purchaseRequest.fulfilment_arrangements?.status ===
        'CONFIRMED'
      ) {
        throw new BadRequestException(
          'A purchase request with a confirmed arrangement cannot be cancelled.',
        );
      }

      // Update the order status.
      const result =
        await tx.purchase_requests.updateMany({
          where: {
            id: requestId,
            restaurant_id: restaurant.id,
            status: purchaseRequest.status,
          },
          data: {
            status: 'CANCELLED',
            updated_at: new Date(),
          },
        });

      if (result.count === 0) {
        throw new BadRequestException(
          'This purchase request can no longer be cancelled.',
        );
      }

      // Restore inventory if the order was accepted.
      if (purchaseRequest.status === 'ACCEPTED') {
        await tx.product_listings.update({
          where: {
            id: purchaseRequest.product_listing_id,
          },
          data: {
            available_quantity: {
              increment: purchaseRequest.requested_quantity,
            },
          },
        });
      }

      // Cancel any associated pending or declined arrangement.
      await tx.fulfilment_arrangements.updateMany({
        where: {
          purchase_request_id: requestId,
          status: {
            in: ['PENDING', 'DECLINED'],
          },
        },
        data: {
          status: 'CANCELLED',
          updated_at: new Date(),
        },
      });

      return tx.purchase_requests.findUnique({
        where: { id: requestId },
      });
    });
  }

  // PRODUCER: Accept an incoming purchase request
  async accept(userId: string, requestId: string) {
    const producer = await this.prisma.producer_profiles.findUnique({
      where: { user_id: userId },
    });

    if (!producer) {
      throw new NotFoundException('Producer profile not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const purchaseRequest =
        await tx.purchase_requests.findFirst({
          where: {
            id: requestId,
            product_listings: {
              producer_id: producer.id,
            },
          },
        });

      if (!purchaseRequest) {
        throw new NotFoundException('Purchase request not found.');
      }

      if (purchaseRequest.status !== 'SUBMITTED') {
        throw new BadRequestException(
          'Only pending purchase requests can be accepted.',
        );
      }

      const stockUpdate = await tx.product_listings.updateMany({
        where: {
          id: purchaseRequest.product_listing_id,
          producer_id: producer.id,
          available_quantity: {
            gte: purchaseRequest.requested_quantity,
          },
        },
        data: {
          available_quantity: {
            decrement: purchaseRequest.requested_quantity,
          },
        },
      });

      if (stockUpdate.count === 0) {
        throw new BadRequestException(
          'Insufficient available quantity to accept this request.',
        );
      }

      const requestUpdate = await tx.purchase_requests.updateMany({
        where: {
          id: requestId,
          status: 'SUBMITTED',
        },
        data: {
          status: 'ACCEPTED',
        },
      });

      if (requestUpdate.count === 0) {
        throw new BadRequestException(
          'This purchase request can no longer be accepted.',
        );
      }

      return tx.purchase_requests.findUnique({
        where: { id: requestId },
      });
    });
  }

  // PRODUCER: Reject an incoming purchase request
  async reject(userId: string, requestId: string) {
    const producer = await this.prisma.producer_profiles.findUnique({
      where: { user_id: userId },
    });

    if (!producer) {
      throw new NotFoundException('Producer profile not found.');
    }

    const purchaseRequest = await this.prisma.purchase_requests.findFirst({
      where: {
        id: requestId,
        product_listings: {
          producer_id: producer.id,
        },
      },
    });

    if (!purchaseRequest) {
      throw new NotFoundException('Purchase request not found.');
    }

    if (purchaseRequest.status !== 'SUBMITTED') {
      throw new BadRequestException(
        'Only pending purchase requests can be rejected.',
      );
    }

    const result = await this.prisma.purchase_requests.updateMany({
      where: {
        id: requestId,
        status: 'SUBMITTED',
        product_listings: {
          producer_id: producer.id,
        },
      },
      data: {
        status: 'REJECTED',
      },
    });

    if (result.count === 0) {
      throw new BadRequestException(
        'This purchase request can no longer be rejected.',
      );
    }

    return this.prisma.purchase_requests.findUnique({
      where: { id: requestId },
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
