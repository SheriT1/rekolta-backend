import {
  IsUUID,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateReportDto {
  @IsUUID()
  productId: string;

  @IsString()
  @Matches(/\S/, {
    message: 'Report reason cannot be empty.',
  })
  @MaxLength(1000)
  reason: string;
}