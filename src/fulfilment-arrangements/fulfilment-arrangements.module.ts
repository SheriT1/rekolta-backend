import { Module } from '@nestjs/common';
import { FulfilmentArrangementsController } from './fulfilment-arrangements.controller.js';
import { FulfilmentArrangementsService } from './fulfilment-arrangements.service.js';

@Module({
  controllers: [FulfilmentArrangementsController],
  providers: [FulfilmentArrangementsService]
})
export class FulfilmentArrangementsModule {}
