import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { hash, compare } from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  // REGISTER
  async register(data: RegisterDto) {
    const email = data.email.trim().toLowerCase();

    const existingUser = await this.prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException(
        'Email is already registered.',
      );
    }

    const passwordHash = await hash(data.password, 12);

    try {
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
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Email is already registered.',
        );
      }

      throw error;
    }
  }

  // LOGIN
  async login(data: LoginDto) {
    const email = data.email.trim().toLowerCase();

    const user = await this.prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Invalid email or password.',
      );
    }

    const passwordMatches = await compare(
      data.password,
      user.password_hash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(
        'Invalid email or password.',
      );
    }

    return {
      message: 'Credentials verified successfully.',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    };
  }
}
