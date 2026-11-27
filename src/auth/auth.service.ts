
import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,

    @Inject(JwtService)
    private readonly jwtService: JwtService,
  ) {}

  // REGISTER
  async register(data: RegisterDto) {
    if (
      data.role !== 'PRODUCER' &&
      data.role !== 'RESTAURANT'
    ) {
      throw new ForbiddenException(
        'Public registration is only available for producers and restaurants.',
      );
    }

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

    // Prevent blocked users from logging in
    if (user.is_blocked) {
      throw new ForbiddenException(
        'Your account has been blocked.',
      );
    }

    // Generate JWT after successful login
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
    });

    return {
      message: 'Credentials verified successfully.',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
      accessToken,
    };
  }

  // GET CURRENT AUTHENTICATED USER
  async getCurrentUser(accessToken: string) {
    if (!accessToken) {
      throw new UnauthorizedException(
        'You are not logged in.',
      );
    }

    let payload: { sub?: unknown };

    try {
      payload = await this.jwtService.verifyAsync<{
        sub?: unknown;
      }>(accessToken);
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired authentication token.',
      );
    }

    if (
      typeof payload.sub !== 'string' ||
      !payload.sub
    ) {
      throw new UnauthorizedException(
        'Invalid authentication token.',
      );
    }

    const user = await this.prisma.users.findUnique({
      where: {
        id: payload.sub,
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        is_blocked: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'User account no longer exists.',
      );
    }

    // Prevent blocked users from using existing sessions
    if (user.is_blocked) {
      throw new ForbiddenException(
        'Your account has been blocked.',
      );
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    };
  }
  async getProfile(accessToken: string) {
  const user = await this.getCurrentUser(accessToken);

  if (user.role === 'PRODUCER') {
    const profile = await this.prisma.producer_profiles.findUnique({
      where: { user_id: user.id },
    });

    if (!profile) {
      throw new NotFoundException('Producer profile not found.');
    }

    return { user, profile };
  }

  if (user.role === 'RESTAURANT') {
    const profile = await this.prisma.restaurant_profiles.findUnique({
      where: { user_id: user.id },
    });

    if (!profile) {
      throw new NotFoundException('Restaurant profile not found.');
    }

    return { user, profile };
  }

  throw new ForbiddenException('Profile management is unavailable for this role.');
}
async updateProfile(accessToken: string, data: UpdateProfileDto) {
  const { user, profile } = await this.getProfile(accessToken);

  if (user.role !== 'PRODUCER' && data.description !== undefined) {
    throw new BadRequestException('Only producers can edit farm descriptions.');
  }

  const locationChanged =
    (data.address !== undefined && data.address.trim() !== profile.address) ||
    (data.city !== undefined && data.city.trim() !== profile.city);

  const commonData = {
    phone: data.phone?.trim(),
    address: data.address?.trim(),
    city: data.city?.trim(),
    ...(locationChanged ? { latitude: null, longitude: null } : {}),
  };

  await this.prisma.$transaction(async (tx) => {
    if (data.fullName !== undefined) {
      await tx.users.update({
        where: { id: user.id },
        data: {
          full_name: data.fullName.trim(),
          updated_at: new Date(),
        },
      });
    }

    if (user.role === 'PRODUCER') {
      await tx.producer_profiles.update({
        where: { user_id: user.id },
        data: {
          ...commonData,
          business_name: data.businessName?.trim(),
          description: data.description?.trim(),
        },
      });
    } else {
      await tx.restaurant_profiles.update({
        where: { user_id: user.id },
        data: {
          ...commonData,
          restaurant_name: data.businessName?.trim(),
        },
      });
    }
  });

  return {
    message: 'Profile updated successfully.',
    ...(await this.getProfile(accessToken)),
  };
}
}
