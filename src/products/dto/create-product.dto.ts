import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  IsPositive,
  IsDateString,
  MaxLength,
  Min,
  IsIn,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsIn(['LOW', 'STANDARD', 'HIGH', 'PREMIUM'], {
    message: 'Quality must be LOW, STANDARD, HIGH or PREMIUM.',
  })
  quality: string;

  @IsNumber()
  @Min(0)
  availableQuantity: number;

  @IsDateString()
  availableFrom: string;

  @IsDateString()
  availableUntil: string;
}