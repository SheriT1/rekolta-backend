
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // PUBLIC: Get all available products
  async findAll() {
    return this.prisma.product_listings.findMany({
      where: {
        is_active: true,
        is_hidden: false,
        available_quantity: {
          gt: 0,
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  // PRODUCER: Get all products belonging to
  // the currently logged-in producer
  async findMine(userId: string) {
    const producer =
      await this.prisma.producer_profiles.findUnique({
        where: {
          user_id: userId,
        },
      });

    if (!producer) {
      throw new NotFoundException(
        'Producer profile not found.',
      );
    }

    return this.prisma.product_listings.findMany({
      where: {
        producer_id: producer.id,
      },
      include: {
        categories: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  // PRODUCER: Create a new product listing
  async create(userId: string, data: CreateProductDto) {
    const producer =
      await this.prisma.producer_profiles.findUnique({
        where: {
          user_id: userId,
        },
      });

    if (!producer) {
      throw new NotFoundException(
        'Producer profile not found.',
      );
    }

    // Ensure the selected category exists
    const category = await this.prisma.categories.findUnique({
      where: {
        id: data.categoryId,
      },
    });

    if (!category) {
      throw new BadRequestException(
        'Selected product category does not exist.',
      );
    }

    // Validate product availability dates
    const availableFrom = new Date(data.availableFrom);
    const availableUntil = new Date(data.availableUntil);

    if (
      Number.isNaN(availableFrom.getTime()) ||
      Number.isNaN(availableUntil.getTime()) ||
      availableUntil < availableFrom
    ) {
      throw new BadRequestException(
        'Availability end date must be on or after the start date.',
      );
    }

    // Save the new product in PostgreSQL
    return this.prisma.product_listings.create({
      data: {
        producer_id: producer.id,
        category_id: category.id,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        price: data.price,
        unit: data.unit.trim(),
        quality: data.quality.trim(),
        available_quantity: data.availableQuantity,
        available_from: availableFrom,
        available_until: availableUntil,
        is_active: true,
        is_hidden: false,
      },
      include: {
        categories: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }
}
