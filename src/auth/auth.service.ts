
import {
  Injectable,
  ConflictException,
} from '@nestjs/common';
import { hash } from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(data: RegisterDto) {
    const email = data.email.trim().toLowerCase();

    // Check whether the email is already registered
    const existingUser = await this.prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered.');
    }

    // Never store the original password
    const passwordHash = await hash(data.password, 12);

    try {
      // Create the user and role-specific profile together
      const user = await this.prisma.users.create({
        data: {
          email,
          password_hash: passwordHash,
          full_name: data.fullName.trim(),
          role: data.role,

          ...(data.role === 'PRODUCER'
            ? {
                producer_profiles: {
                  create: {
                    business_name: data.businessName.trim(),
                    phone: data.phone.trim(),
                    address: data.address.trim(),
                    city: data.city.trim(),
                  },
                },
              }
            : {
                restaurant_profiles: {
                  create: {
                    restaurant_name: data.businessName.trim(),
                    phone: data.phone.trim(),
                    address: data.address.trim(),
                    city: data.city.trim(),
                  },
                },
              }),
        },
        select: {
          id: true,
          email: true,
          full_name: true,
          role: true,
          created_at: true,
        },
      });

      return {
        message: 'Account created successfully.',
        user,
      };
    } catch (error: unknown) {
      // Handle duplicate-email requests that happen at the same time
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered.');
      }

      throw error;
    }
  }
}

