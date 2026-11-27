import { IsString, MaxLength, Matches, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(150)
  fullName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  businessName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(30)
  phone?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(255)
  address?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  city?: string;
}