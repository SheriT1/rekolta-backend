import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { FulfilmentArrangementsController } from './fulfilment-arrangements.controller.js';
import { FulfilmentArrangementsService } from './fulfilment-arrangements.service.js';

@Module({
  imports: [AuthModule],
  controllers: [FulfilmentArrangementsController],
  providers: [
    FulfilmentArrangementsService,
    PrismaService,
  ],
})
export class FulfilmentArrangementsModule {}
