
import { IsNumber, IsPositive, IsUUID } from 'class-validator';

export class CreatePurchaseRequestDto {
  @IsUUID()
  productListingId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  requestedQuantity: number;
}
