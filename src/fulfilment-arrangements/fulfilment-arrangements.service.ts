
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateFulfilmentArrangementDto } from './dto/create-fulfilment-arrangement.dto.js';
import { CreateCounterproposalDto } from './dto/create-counterproposal.dto.js';

@Injectable()
export class FulfilmentArrangementsService {
  constructor(private readonly prisma: PrismaService) {}

  // Shared validation for original and alternative proposals
  private validateProposalDetails(
    data: CreateCounterproposalDto,
  ) {
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
      (
        typeof data.deliveryAddress !== 'string' ||
        !data.deliveryAddress.trim() ||
        data.deliveryAddress.length > 255
      )
    ) {
      throw new BadRequestException(
        'A valid delivery address is required.',
      );
    }

    if (
      data.method === 'PICKUP' &&
      (
        typeof data.pickupPoint !== 'string' ||
        !data.pickupPoint.trim() ||
        data.pickupPoint.length > 255
      )
    ) {
      throw new BadRequestException(
        'A valid pickup point is required.',
      );
    }

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

    if (data.preferredTime != null) {
      if (
        typeof data.preferredTime !== 'string' ||
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

    return {
      method: data.method,
      deliveryAddress:
        data.method === 'DELIVERY'
          ? data.deliveryAddress!.trim()
          : null,
      pickupPoint:
        data.method === 'PICKUP'
          ? data.pickupPoint!.trim()
          : null,
      preferredDate,
      preferredTime,
      message,
    };
  }

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

    const proposal = this.validateProposalDetails(data);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Recheck and lock the purchase request.
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

        return tx.fulfilment_arrangements.create({
          data: {
            purchase_request_id: purchaseRequest.id,
            method: proposal.method,
            delivery_address: proposal.deliveryAddress,
            pickup_point: proposal.pickupPoint,
            preferred_date: proposal.preferredDate,
            preferred_time: proposal.preferredTime,
            message: proposal.message,
            status: 'PENDING',
          },
        });
      });
    } catch (error) {
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

  // PRODUCER: Decline a pending arrangement
  async decline(
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
          'Only pending arrangements can be declined.',
        );
      }

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
            updated_at: new Date(),
          },
        });

      if (requestUpdate.count === 0) {
        throw new ConflictException(
          'This purchase request is no longer available for arrangement.',
        );
      }

      const arrangementUpdate =
        await tx.fulfilment_arrangements.updateMany({
          where: {
            id: arrangementId,
            status: 'PENDING',
          },
          data: {
            status: 'DECLINED',
            updated_at: new Date(),
          },
        });

      if (arrangementUpdate.count === 0) {
        throw new ConflictException(
          'This arrangement can no longer be declined.',
        );
      }

      return tx.fulfilment_arrangements.findUnique({
        where: { id: arrangementId },
      });
    });
  }

  // PRODUCER: Suggest an alternative arrangement
  async counterproposal(
    userId: string,
    arrangementId: string,
    data: CreateCounterproposalDto,
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

    const proposal = this.validateProposalDetails(data);

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
          'Changes can only be suggested for pending arrangements.',
        );
      }

      // Lock the purchase request while preserving
      // its ACCEPTED status.
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
            updated_at: new Date(),
          },
        });

      if (requestUpdate.count === 0) {
        throw new ConflictException(
          'This purchase request is no longer available for arrangement.',
        );
      }

      // Save the alternative proposal without
      // overwriting the original restaurant proposal.
      const arrangementUpdate =
        await tx.fulfilment_arrangements.updateMany({
          where: {
            id: arrangementId,
            status: 'PENDING',
          },
          data: {
            counter_method: proposal.method,
            counter_delivery_address:
              proposal.deliveryAddress,
            counter_pickup_point:
              proposal.pickupPoint,
            counter_preferred_date:
              proposal.preferredDate,
            counter_preferred_time:
              proposal.preferredTime,
            counter_message: proposal.message,
            status: 'COUNTERPROPOSED',
            updated_at: new Date(),
          },
        });

      if (arrangementUpdate.count === 0) {
        throw new ConflictException(
          'This arrangement is no longer available for changes.',
        );
      }

      return tx.fulfilment_arrangements.findUnique({
        where: { id: arrangementId },
      });
    });
  }
}
