import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FavoritesController } from './favorites.controller.js';
import { FavoritesService } from './favorites.service.js';

@Module({
  imports: [AuthModule],
  controllers: [FavoritesController],
  providers: [FavoritesService, PrismaService],
})
export class FavoritesModule {}