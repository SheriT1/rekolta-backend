
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

 // PUBLIC: Get all available products with their categories
async findAll() {
  return this.prisma.product_listings.findMany({
    where: {
      is_active: true,
      is_hidden: false,
      available_quantity: { gt: 0 },
    },
include: {
  categories: {
    select: {
      id: true,
      name: true,
    },
  },
  producer_profiles: {
    select: {
      business_name: true,
      city: true,
    },
  },
  product_images: {
    orderBy: {
      sort_order: 'asc',
    },
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
        is_hidden: false,
      },
      include: {
  categories: {
    select: {
      id: true,
      name: true,
    },
  },
  product_images: {
    orderBy: {
      sort_order: 'asc',
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

  // PRODUCER: Delete an existing product listing
  async remove(userId: string, productId: string) {
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

    // Prevent producers from deleting other producers' products
    if (product.producer_id !== producer.id) {
      throw new ForbiddenException(
        'You can only delete your own products.',
      );
    }

    // Soft delete: hide the listing without removing database records
    return this.prisma.product_listings.update({
      where: {
        id: productId,
      },
      data: {
        is_active: false,
        is_hidden: true,
      },
    });
  }

  // PRODUCER: Upload a photo to an existing product
  async uploadImage(
    userId: string,
    productId: string,
    file: Express.Multer.File,
  ) {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException(
        'Please select an image to upload.',
      );
    }

    // Check the actual file signature, not just its extension
    const buffer = file.buffer;

    const isJpeg =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;

    const isPng =
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );

    const isWebp =
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';

    let extension: string;

    if (isJpeg) {
      extension = 'jpg';
    } else if (isPng) {
      extension = 'png';
    } else if (isWebp) {
      extension = 'webp';
    } else {
      throw new UnsupportedMediaTypeException(
        'Only JPEG, PNG, and WebP images are supported.',
      );
    }

    if (buffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException(
        'Images must not exceed 5 MB.',
      );
    }

    // Identify the authenticated producer
    const producer =
      await this.prisma.producer_profiles.findUnique({
        where: { user_id: userId },
      });

    if (!producer) {
      throw new NotFoundException(
        'Producer profile not found.',
      );
    }

    // Verify that this producer owns the product
    const product =
      await this.prisma.product_listings.findUnique({
        where: { id: productId },
      });

    if (!product || product.is_hidden) {
      throw new NotFoundException(
        'Product not found.',
      );
    }

    if (product.producer_id !== producer.id) {
      throw new ForbiddenException(
        'You can only upload images to your own products.',
      );
    }

    // Enforce the maximum number of images
    const existingImages =
      await this.prisma.product_images.findMany({
        where: { product_listing_id: productId },
        orderBy: { sort_order: 'asc' },
      });

    if (existingImages.length >= 5) {
      throw new BadRequestException(
        'A product can have a maximum of 5 images.',
      );
    }

    const filename = `${randomUUID()}.${extension}`;

    const uploadDirectory = join(
      process.cwd(),
      'uploads',
      'products',
    );

    const filePath = join(uploadDirectory, filename);
    const imageUrl = `/uploads/products/${filename}`;

    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(filePath, buffer, { flag: 'wx' });

    try {
      // Save the image reference in PostgreSQL
      return await this.prisma.product_images.create({
        data: {
          product_listing_id: productId,
          image_url: imageUrl,
          sort_order: existingImages.length,
          is_cover: existingImages.length === 0,
        },
      });
    } catch (error) {
      // Avoid leaving a file behind if the database insert fails
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

}