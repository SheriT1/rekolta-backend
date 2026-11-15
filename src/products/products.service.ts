
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

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

  // PRODUCER: Update an existing product listing
  async update(
    userId: string,
    productId: string,
    data: UpdateProductDto,
  ) {
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

    const product =
      await this.prisma.product_listings.findUnique({
        where: {
          id: productId,
        },
      });

    if (!product) {
      throw new NotFoundException(
        'Product not found.',
      );
    }

    // Prevent producers from editing other producers' products
    if (product.producer_id !== producer.id) {
      throw new ForbiddenException(
        'You can only edit your own products.',
      );
    }

    // Validate the new category, if one was provided
    if (data.categoryId !== undefined) {
      const category =
        await this.prisma.categories.findUnique({
          where: {
            id: data.categoryId,
          },
        });

      if (!category) {
        throw new BadRequestException(
          'Selected product category does not exist.',
        );
      }
    }

    // Use existing dates when they are not being changed
    const availableFrom =
      data.availableFrom !== undefined
        ? new Date(data.availableFrom)
        : product.available_from;

    const availableUntil =
      data.availableUntil !== undefined
        ? new Date(data.availableUntil)
        : product.available_until;

    if (
      Number.isNaN(availableFrom.getTime()) ||
      Number.isNaN(availableUntil.getTime()) ||
      availableUntil < availableFrom
    ) {
      throw new BadRequestException(
        'Availability end date must be on or after the start date.',
      );
    }

    // Update only the fields supplied by the producer
    return this.prisma.product_listings.update({
      where: {
        id: productId,
      },
      data: {
        ...(data.categoryId !== undefined && {
          category_id: data.categoryId,
        }),
        ...(data.name !== undefined && {
          name: data.name.trim(),
        }),
        ...(data.description !== undefined && {
          description: data.description.trim() || null,
        }),
        ...(data.price !== undefined && {
          price: data.price,
        }),
        ...(data.unit !== undefined && {
          unit: data.unit.trim(),
        }),
        ...(data.quality !== undefined && {
          quality: data.quality.trim(),
        }),
        ...(data.availableQuantity !== undefined && {
          available_quantity: data.availableQuantity,
        }),
        available_from: availableFrom,
        available_until: availableUntil,
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
