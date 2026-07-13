import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpsertMarketComparableDto {
  @IsString()
  costCenterId!: string;

  @IsString()
  @MinLength(1)
  projectName!: string;

  @IsOptional()
  @IsString()
  developerName?: string;

  @IsString()
  @MinLength(1)
  location!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @IsOptional()
  @IsString()
  houseType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  usableAreaSqm?: number;

  @IsNumber()
  @Min(0)
  priceMin!: number;

  @IsNumber()
  @Min(0)
  priceMax!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  unitsTotal?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  unitsSold?: number;

  @IsOptional()
  @IsDateString()
  launchDate?: string;

  @IsOptional()
  @IsString()
  promotion?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
