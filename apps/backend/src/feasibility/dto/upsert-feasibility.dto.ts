import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { FeasibilityCostCategory } from '@prisma/client';

export class FeasibilityCostItemInput {
  @IsEnum(FeasibilityCostCategory)
  category!: FeasibilityCostCategory;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpsertFeasibilityDto {
  @IsInt()
  @Min(1)
  houseCount!: number;

  @IsNumber()
  @Min(0)
  sellingPricePerUnit!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  equityAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  corporateTaxRatePercent?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => FeasibilityCostItemInput)
  costItems!: FeasibilityCostItemInput[];
}
