import { Test, TestingModule } from '@nestjs/testing';
import { FulfilmentArrangementsController } from './fulfilment-arrangements.controller.js';

describe('FulfilmentArrangementsController', () => {
  let controller: FulfilmentArrangementsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FulfilmentArrangementsController],
    }).compile();

    controller = module.get<FulfilmentArrangementsController>(FulfilmentArrangementsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
