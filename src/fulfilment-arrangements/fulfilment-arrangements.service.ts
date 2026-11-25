
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateFulfilmentArrangementDto } from './dto/create-fulfilment-arrangement.dto.js';

@Injectable()
export class FulfilmentArrangementsService {
  constructor(private readonly prisma: PrismaService) {}

  // RESTAURANT: Propose pickup or delivery
  async create(
    userId: string,
    data: CreateFulfilmentArrangementDto,
  ) {
    const restaurant =
      await this.prisma.restaurant_profiles.findUnique({
        where: { user_id: userId },
      });

    if (!restaurant) {
      throw new NotFoundException(
        'Restaurant profile not found.',
      );
    }

    const purchaseRequest =
      await this.prisma.purchase_requests.findFirst({
        where: {
          id: data.purchaseRequestId,
          restaurant_id: restaurant.id,
        },
      });

    if (!purchaseRequest) {
      throw new NotFoundException(
        'Purchase request not found.',
      );
    }

    if (purchaseRequest.status !== 'ACCEPTED') {
      throw new BadRequestException(
        'Pickup or delivery can only be arranged for accepted orders.',
      );
    }

    const preferredDate = new Date(
      `${data.preferredDate}T00:00:00.000Z`,
    );

    if (
      !Number.isFinite(preferredDate.getTime()) ||
      preferredDate.toISOString().slice(0, 10) !==
        data.preferredDate
    ) {
      throw new BadRequestException(
        'Invalid preferred date.',
      );
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (preferredDate < today) {
      throw new BadRequestException(
        'The preferred date cannot be in the past.',
      );
    }

    if (
      data.method !== 'PICKUP' &&
      data.method !== 'DELIVERY'
    ) {
      throw new BadRequestException(
        'Choose PICKUP or DELIVERY.',
      );
    }

    if (
      data.method === 'DELIVERY' &&
      !data.deliveryAddress?.trim()
    ) {
      throw new BadRequestException(
        'A delivery address is required.',
      );
    }

    if (
      data.method === 'PICKUP' &&
      !data.pickupPoint?.trim()
    ) {
      throw new BadRequestException(
        'A pickup point is required.',
      );
    }

    // Validate and normalize the optional message.
    if (
      data.message != null &&
      typeof data.message !== 'string'
    ) {
      throw new BadRequestException(
        'The message must be a string.',
      );
    }

    if (
      data.message != null &&
      data.message.length > 500
    ) {
      throw new BadRequestException(
        'The message cannot exceed 500 characters.',
      );
    }

    const message = data.message?.trim() || null;

    let preferredTime: Date | null = null;

    if (data.preferredTime) {
      if (
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(
          data.preferredTime,
        )
      ) {
        throw new BadRequestException(
          'Preferred time must use HH:MM format.',
        );
      }

      preferredTime = new Date(
        `1970-01-01T${data.preferredTime}:00.000Z`,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Recheck and lock the purchase request before
        // creating the fulfilment arrangement.
        const requestUpdate =
          await tx.purchase_requests.updateMany({
            where: {
              id: purchaseRequest.id,
              restaurant_id: restaurant.id,
              status: 'ACCEPTED',
            },
            data: {
              updated_at: new Date(),
            },
          });

        if (requestUpdate.count === 0) {
          throw new ConflictException(
            'This purchase request is no longer available for arrangement.',
          );
        }

        // The unique purchase_request_id constraint
        // prevents multiple arrangements for one order.
        return tx.fulfilment_arrangements.create({
          data: {
            purchase_request_id: purchaseRequest.id,
            method: data.method,
            delivery_address:
              data.method === 'DELIVERY'
                ? data.deliveryAddress!.trim()
                : null,
            pickup_point:
              data.method === 'PICKUP'
                ? data.pickupPoint!.trim()
                : null,
            preferred_date: preferredDate,
            preferred_time: preferredTime,
            message,
            status: 'PENDING',
          },
        });
      });
    } catch (error) {
      // Prisma unique constraint violation.
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An arrangement already exists for this order.',
        );
      }

      throw error;
    }
  }

  // RESTAURANT / PRODUCER: View an arrangement
  async findByRequest(
    userId: string,
    requestId: string,
  ) {
    const purchaseRequest =
      await this.prisma.purchase_requests.findUnique({
        where: { id: requestId },
        include: {
          restaurant_profiles: {
            select: { user_id: true },
          },
          product_listings: {
            include: {
              producer_profiles: {
                select: { user_id: true },
              },
            },
          },
          fulfilment_arrangements: true,
        },
      });

    if (!purchaseRequest) {
      throw new NotFoundException(
        'Purchase request not found.',
      );
    }

    const isRestaurant =
      purchaseRequest.restaurant_profiles.user_id ===
      userId;

    const isProducer =
      purchaseRequest.product_listings.producer_profiles
        .user_id === userId;

    if (!isRestaurant && !isProducer) {
      throw new ForbiddenException(
        'You cannot view this arrangement.',
      );
    }

    return purchaseRequest.fulfilment_arrangements;
  }

  // PRODUCER: Confirm a pending arrangement
  async confirm(
    userId: string,
    arrangementId: string,
  ) {
    const producer =
      await this.prisma.producer_profiles.findUnique({
        where: { user_id: userId },
      });

    if (!producer) {
      throw new NotFoundException(
        'Producer profile not found.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const arrangement =
        await tx.fulfilment_arrangements.findFirst({
          where: {
            id: arrangementId,
            purchase_requests: {
              product_listings: {
                producer_id: producer.id,
              },
            },
          },
          include: {
            purchase_requests: true,
          },
        });

      if (!arrangement) {
        throw new NotFoundException(
          'Arrangement not found.',
        );
      }

      if (
        arrangement.purchase_requests.status !==
        'ACCEPTED'
      ) {
        throw new BadRequestException(
          'The order must still be accepted.',
        );
      }

      if (arrangement.status !== 'PENDING') {
        throw new BadRequestException(
          'Only pending arrangements can be confirmed.',
        );
      }

      // Transition the purchase request to ARRANGED.
      const requestUpdate =
        await tx.purchase_requests.updateMany({
          where: {
            id: arrangement.purchase_request_id,
            status: 'ACCEPTED',
            product_listings: {
              producer_id: producer.id,
            },
          },
          data: {
            status: 'ARRANGED',
            updated_at: new Date(),
          },
        });

      if (requestUpdate.count === 0) {
        throw new ConflictException(
          'This purchase request can no longer be arranged.',
        );
      }

      // Confirm the fulfilment arrangement.
      const arrangementUpdate =
        await tx.fulfilment_arrangements.updateMany({
          where: {
            id: arrangementId,
            status: 'PENDING',
          },
          data: {
            status: 'CONFIRMED',
            updated_at: new Date(),
          },
        });

      if (arrangementUpdate.count === 0) {
        throw new ConflictException(
          'This arrangement can no longer be confirmed.',
        );
      }

      return tx.fulfilment_arrangements.findUnique({
        where: { id: arrangementId },
      });
    });
  }
}
