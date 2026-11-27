import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecommendations(
    userId: string,
    categoryId: string,
    productName: string,
    unit: string,
    quantity: number,
  ) {
    const restaurant =
      await this.prisma.restaurant_profiles.findUnique({
        where: {
          user_id: userId,
        },
        select: {
          latitude: true,
          longitude: true,
        },
      });

    if (!restaurant) {
      throw new ForbiddenException(
        'Restaurant profile not found.',
      );
    }

    if (
      restaurant.latitude === null ||
      restaurant.longitude === null
    ) {
      throw new BadRequestException(
        'Restaurant location is not available.',
      );
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Retrieve eligible product listings
    const products =
      await this.prisma.product_listings.findMany({
        where: {
          category_id: categoryId,
          name: {
            equals: productName.trim(),
            mode: 'insensitive',
          },
          unit: {
            equals: unit.trim(),
            mode: 'insensitive',
          },
          is_active: true,
          is_hidden: false,
          available_quantity: {
            gte: quantity,
          },
          available_from: {
            lte: today,
          },
          available_until: {
            gte: today,
          },
          producer_profiles: {
            latitude: { not: null },
            longitude: { not: null },
            users: {
              is_blocked: false,
            },
          },
        },
        include: {
          categories: true,
          producer_profiles: {
            select: {
              business_name: true,
              city: true,
              latitude: true,
              longitude: true,
            },
          },
          product_images: {
            orderBy: {
              sort_order: 'asc',
            },
          },
        },
      });

    // Calculate distance for each eligible product
    const candidates = products.flatMap((product) => {
      const { latitude, longitude } =
        product.producer_profiles;

      if (latitude === null || longitude === null) {
        return [];
      }

      return [
        {
          ...product,
          distance: this.calculateDistance(
            restaurant.latitude!,
            restaurant.longitude!,
            latitude,
            longitude,
          ),
        },
      ];
    });

    if (candidates.length === 0) {
      return [];
    }

    // Determine minimum and maximum values
    const prices = candidates.map((product) =>
      Number(product.price),
    );

    const distances = candidates.map(
      (product) => product.distance,
    );

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minDistance = Math.min(...distances);
    const maxDistance = Math.max(...distances);

    // Calculate recommendation scores
    const rankedProducts = candidates.map((product) => {
      const priceScore = this.normalizeInverse(
        Number(product.price),
        minPrice,
        maxPrice,
      );

      const qualityScore = this.calculateQualityScore(
        product.quality,
      );

      const distanceScore = this.normalizeInverse(
        product.distance,
        minDistance,
        maxDistance,
      );

      const recommendationScore = this.calculateScore(
        priceScore,
        qualityScore,
        distanceScore,
      );

      return {
        ...product,
        priceScore,
        qualityScore,
        distanceScore,
        recommendationScore,
      };
    });

    // Sort products and assign ranking positions
    return rankedProducts
      .sort(
        (a, b) =>
          b.recommendationScore - a.recommendationScore ||
          Number(a.price) - Number(b.price) ||
          a.distance - b.distance ||
          a.id.localeCompare(b.id),
      )
      .map((product, index) => ({
        ...product,
        rank: index + 1,
      }));
  }

  // Calculate geographical distance in kilometres
  // using the Haversine formula
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const earthRadius = 6371;

    const toRadians = (degrees: number) =>
      (degrees * Math.PI) / 180;

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;

    return (
      2 *
      earthRadius *
      Math.asin(Math.sqrt(Math.min(1, a)))
    );
  }

  // Normalize criteria where lower values are preferred
  private normalizeInverse(
    value: number,
    min: number,
    max: number,
  ): number {
    if (min === max) {
      return 1;
    }

    return (max - value) / (max - min);
  }

  // Convert quality levels into numerical scores
  private calculateQualityScore(quality: string): number {
    switch (quality.toUpperCase()) {
      case 'LOW':
        return 0;
      case 'STANDARD':
        return 1 / 3;
      case 'HIGH':
        return 2 / 3;
      case 'PREMIUM':
        return 1;
      default:
        return 0;
    }
  }

  // Calculate the final weighted recommendation score
  private calculateScore(
    priceScore: number,
    qualityScore: number,
    distanceScore: number,
  ): number {
    return (
      0.40 * priceScore +
      0.35 * qualityScore +
      0.25 * distanceScore
    );
  }
}