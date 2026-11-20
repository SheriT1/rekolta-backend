
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PurchaseRequestsController } from './purchase-requests.controller.js';
import { PurchaseRequestsService } from './purchase-requests.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PurchaseRequestsController],
  providers: [PurchaseRequestsService, PrismaService],
})
export class PurchaseRequestsModule {}
