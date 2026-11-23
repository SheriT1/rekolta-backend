import { Test, TestingModule } from '@nestjs/testing';
import { FulfilmentArrangementsService } from './fulfilment-arrangements.service.js';

describe('FulfilmentArrangementsService', () => {
  let service: FulfilmentArrangementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FulfilmentArrangementsService],
    }).compile();

    service = module.get<FulfilmentArrangementsService>(FulfilmentArrangementsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
