import { Type } from 'class-transformer';

import {
  IsUUID,
  IsString,
  Matches,
  MaxLength,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class GetRecommendationsDto {
  @IsUUID()
  categoryId: string;

  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  productName: string;

  @IsString()
  @Matches(/\S/)
  @MaxLength(20)
  unit: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  quantity: number;
}