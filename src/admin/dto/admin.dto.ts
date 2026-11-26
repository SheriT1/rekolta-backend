
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateUserBlockDto {
  @IsBoolean()
  isBlocked: boolean;
}

export class UpdateProductVisibilityDto {
  @IsBoolean()
  isHidden: boolean;
}

export class UpdateReportDto {
  @IsIn(['REVIEWED', 'RESOLVED', 'DISMISSED'])
  status: 'REVIEWED' | 'RESOLVED' | 'DISMISSED';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNotes?: string;
}

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
