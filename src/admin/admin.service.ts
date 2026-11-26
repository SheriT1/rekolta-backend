
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

import {
  CreateCategoryDto,
  UpdateCategoryDto,
  UpdateReportDto,
} from './dto/admin.dto.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // DASHBOARD STATISTICS

  async getStats() {
    const [
      restaurants,
      producers,
      productListings,
      pendingReports,
    ] = await Promise.all([
      this.prisma.users.count({
        where: { role: 'RESTAURANT' },
      }),
      this.prisma.users.count({
        where: { role: 'PRODUCER' },
      }),
      this.prisma.product_listings.count(),
      this.prisma.reports.count({
        where: { status: 'PENDING' },
      }),
    ]);

    return {
      restaurants,
      producers,
      productListings,
      pendingReports,
    };
  }

  // USER MANAGEMENT

  async getUsers() {
    return this.prisma.users.findMany({
      where: {
        role: {
          in: ['PRODUCER', 'RESTAURANT'],
        },
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        is_blocked: true,
        created_at: true,
        producer_profiles: {
          select: {
            business_name: true,
            city: true,
          },
        },
        restaurant_profiles: {
          select: {
            restaurant_name: true,
            city: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async updateUserBlock(
    userId: string,
    isBlocked: boolean,
  ) {
    const result = await this.prisma.users.updateMany({
      where: {
        id: userId,
        role: {
          in: ['PRODUCER', 'RESTAURANT'],
        },
      },
      data: {
        is_blocked: isBlocked,
        updated_at: new Date(),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException(
        'Manageable user account not found.',
      );
    }

    return {
      message: isBlocked
        ? 'User blocked successfully.'
        : 'User unblocked successfully.',
      id: userId,
      isBlocked,
    };
  }

  // PRODUCT MODERATION

  async getProducts() {
    return this.prisma.product_listings.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        unit: true,
        available_quantity: true,
        is_active: true,
        is_hidden: true,
        created_at: true,
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
        _count: {
          select: {
            reports: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async updateProductVisibility(
    productId: string,
    isHidden: boolean,
  ) {
    const result =
      await this.prisma.product_listings.updateMany({
        where: {
          id: productId,
        },
        data: {
          is_hidden: isHidden,
          updated_at: new Date(),
        },
      });

    if (result.count === 0) {
      throw new NotFoundException(
        'Product listing not found.',
      );
    }

    return {
      message: isHidden
        ? 'Product hidden successfully.'
        : 'Product restored successfully.',
      id: productId,
      isHidden,
    };
  }

  // REPORT MANAGEMENT

  async getReports() {
    return this.prisma.reports.findMany({
      select: {
        id: true,
        reason: true,
        status: true,
        admin_notes: true,
        created_at: true,
        updated_at: true,
        product_listings: {
          select: {
            id: true,
            name: true,
            is_hidden: true,
            producer_profiles: {
              select: {
                business_name: true,
              },
            },
          },
        },
        restaurant_profiles: {
          select: {
            restaurant_name: true,
          },
        },
        users: {
          select: {
            full_name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async updateReport(
    reportId: string,
    adminId: string,
    data: UpdateReportDto,
  ) {
    const result = await this.prisma.reports.updateMany({
      where: {
        id: reportId,
      },
      data: {
        status: data.status,
        reviewed_by: adminId,
        ...(data.adminNotes !== undefined
          ? {
              admin_notes:
                data.adminNotes.trim() || null,
            }
          : {}),
        updated_at: new Date(),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException(
        'Report not found.',
      );
    }

    return {
      message: 'Report updated successfully.',
      id: reportId,
      status: data.status,
    };
  }

  // CATEGORY MANAGEMENT

  async getCategories() {
    return this.prisma.categories.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        _count: {
          select: {
            product_listings: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async createCategory(data: CreateCategoryDto) {
    const name = data.name.trim();

    if (!name) {
      throw new BadRequestException(
        'Category name is required.',
      );
    }

    try {
      return await this.prisma.categories.create({
        data: {
          name,
          description:
            data.description?.trim() || null,
        },
      });
    } catch (error) {
      if (this.hasErrorCode(error, 'P2002')) {
        throw new ConflictException(
          'A category with this name already exists.',
        );
      }

      throw error;
    }
  }

  async updateCategory(
    categoryId: string,
    data: UpdateCategoryDto,
  ) {
    const name = data.name?.trim();

    if (data.name !== undefined && !name) {
      throw new BadRequestException(
        'Category name cannot be empty.',
      );
    }

    if (
      data.name === undefined &&
      data.description === undefined
    ) {
      throw new BadRequestException(
        'No category changes were provided.',
      );
    }

    try {
      return await this.prisma.categories.update({
        where: {
          id: categoryId,
        },
        data: {
          ...(name !== undefined
            ? { name }
            : {}),
          ...(data.description !== undefined
            ? {
                description:
                  data.description.trim() || null,
              }
            : {}),
        },
      });
    } catch (error) {
      if (this.hasErrorCode(error, 'P2025')) {
        throw new NotFoundException(
          'Category not found.',
        );
      }

      if (this.hasErrorCode(error, 'P2002')) {
        throw new ConflictException(
          'A category with this name already exists.',
        );
      }

      throw error;
    }
  }

  async deleteCategory(categoryId: string) {
    const category =
      await this.prisma.categories.findUnique({
        where: {
          id: categoryId,
        },
        select: {
          id: true,
          _count: {
            select: {
              product_listings: true,
            },
          },
        },
      });

    if (!category) {
      throw new NotFoundException(
        'Category not found.',
      );
    }

    if (category._count.product_listings > 0) {
      throw new ConflictException(
        'Cannot delete a category containing product listings.',
      );
    }

    try {
      await this.prisma.categories.delete({
        where: {
          id: categoryId,
        },
      });
    } catch (error) {
      if (this.hasErrorCode(error, 'P2003')) {
        throw new ConflictException(
          'Cannot delete a category containing product listings.',
        );
      }

      if (this.hasErrorCode(error, 'P2025')) {
        throw new NotFoundException(
          'Category not found.',
        );
      }

      throw error;
    }

    return {
      message: 'Category deleted successfully.',
    };
  }

  private hasErrorCode(
    error: unknown,
    code: string,
  ): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === code
    );
  }
}
