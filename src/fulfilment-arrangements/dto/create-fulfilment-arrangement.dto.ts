
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateFulfilmentArrangementDto {
  @IsUUID()
  purchaseRequestId: string;

  @IsIn(['PICKUP', 'DELIVERY'])
  method: 'PICKUP' | 'DELIVERY';

  @IsDateString()
  preferredDate: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  preferredTime?: string;

  @ValidateIf((o) => o.method === 'DELIVERY')
  @IsString()
  @MaxLength(255)
  deliveryAddress?: string;

  @ValidateIf((o) => o.method === 'PICKUP')
  @IsString()
  @MaxLength(255)
  pickupPoint?: string;
}
