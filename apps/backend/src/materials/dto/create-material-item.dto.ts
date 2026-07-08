import { IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { FeasibilityCostCategory } from '@prisma/client';

export class CreateMaterialItemDto {
  @IsString()
  costCenterId!: string;

  @IsString()
  @MinLength(1)
  category!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  unit!: string;

  @IsNumber()
  @Min(0)
  plannedQuantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  materialUnitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  laborUnitPrice?: number;

  @IsOptional()
  @IsEnum(FeasibilityCostCategory)
  feasibilityCategory?: FeasibilityCostCategory;

  @IsOptional()
  @IsString()
  notes?: string;
}
