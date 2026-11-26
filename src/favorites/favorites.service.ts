import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getRestaurantId(userId: string) {
    const restaurant =
      await this.prisma.restaurant_profiles.findUnique({
        where: { user_id: userId },
        select: { id: true },
      });

    if (!restaurant) {
      throw new NotFoundException(
        'Restaurant profile not found.',
      );
    }

    return restaurant.id;
  }

  async findAll(userId: string) {
    const restaurantId = await this.getRestaurantId(userId);

    const favorites = await this.prisma.favorites.findMany({
      where: {
        restaurant_id: restaurantId,
        product_listings: {
          is_hidden: false,
          is_active: true,
        },
      },
      include: {
        product_listings: {
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
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return favorites.map(
      (favorite) => favorite.product_listings,
    );
  }

  async add(userId: string, productId: string) {
    const restaurantId = await this.getRestaurantId(userId);

    const product =
      await this.prisma.product_listings.findFirst({
        where: {
          id: productId,
          is_active: true,
          is_hidden: false,
          available_quantity: { gt: 0 },
        },
        select: { id: true },
      });

    if (!product) {
      throw new NotFoundException(
        'Product is not available.',
      );
    }

    await this.prisma.favorites.createMany({
      data: [
        {
          restaurant_id: restaurantId,
          product_listing_id: productId,
        },
      ],
      skipDuplicates: true,
    });

    return {
      message: 'Product added to favorites.',
      isFavorite: true,
    };
  }

  async remove(userId: string, productId: string) {
    const restaurantId = await this.getRestaurantId(userId);

    await this.prisma.favorites.deleteMany({
      where: {
        restaurant_id: restaurantId,
        product_listing_id: productId,
      },
    });

    return {
      message: 'Product removed from favorites.',
      isFavorite: false,
    };
  }
}