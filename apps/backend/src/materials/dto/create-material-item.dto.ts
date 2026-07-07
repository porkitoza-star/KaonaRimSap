import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

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
  @IsString()
  notes?: string;
}
