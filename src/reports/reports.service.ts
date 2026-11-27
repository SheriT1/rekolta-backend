import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(userId: string, data: CreateReportDto) {
    const restaurant =
      await this.prisma.restaurant_profiles.findUnique({
        where: {
          user_id: userId,
        },
        select: {
          id: true,
        },
      });

    if (!restaurant) {
      throw new ForbiddenException(
        'Restaurant profile not found.',
      );
    }

    const product =
      await this.prisma.product_listings.findFirst({
        where: {
          id: data.productId,
          is_active: true,
          is_hidden: false,
        },
        select: {
          id: true,
        },
      });

    if (!product) {
      throw new NotFoundException(
        'Product listing not found.',
      );
    }

    const existingReport =
      await this.prisma.reports.findFirst({
        where: {
          restaurant_id: restaurant.id,
          product_listing_id: product.id,
          status: 'PENDING',
        },
      });

    if (existingReport) {
      throw new ConflictException(
        'You already have an open report for this listing.',
      );
    }

    const report = await this.prisma.reports.create({
      data: {
        restaurant_id: restaurant.id,
        product_listing_id: product.id,
        reason: data.reason.trim(),
        status: 'PENDING',
      },
      select: {
        id: true,
        status: true,
        created_at: true,
      },
    });

    return {
      message: 'Report submitted successfully.',
      report,
    };
  }
}