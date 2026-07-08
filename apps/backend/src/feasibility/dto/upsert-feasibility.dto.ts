import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpsertFeasibilityDto {
  @IsInt()
  @Min(1)
  houseCount!: number;

  @IsNumber()
  @Min(0)
  constructionCostPerUnit!: number;

  @IsNumber()
  @Min(0)
  landCostPerUnit!: number;

  @IsNumber()
  @Min(0)
  otherCostPerUnit!: number;

  @IsNumber()
  @Min(0)
  sellingPricePerUnit!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
