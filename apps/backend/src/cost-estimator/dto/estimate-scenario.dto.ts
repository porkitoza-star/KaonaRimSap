import { IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { EstimatorGrade, EstimatorRoofType } from '../cost-rate-card';

const GRADES: EstimatorGrade[] = ['STANDARD', 'HIGH', 'LUXURY', 'PREMIUM'];
const ROOF_TYPES: EstimatorRoofType[] = ['GABLE', 'HIP', 'MONO_PITCH', 'FLAT'];

export class EstimateScenarioDto {
  @IsNumber()
  @Min(1)
  areaSqm!: number;

  @IsInt()
  @IsIn([1, 2, 3])
  floors!: 1 | 2 | 3;

  @IsIn(GRADES)
  grade!: EstimatorGrade;

  @IsIn(ROOF_TYPES)
  roofType!: EstimatorRoofType;

  @IsOptional()
  @IsInt()
  @Min(1)
  houseCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPricePerUnit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  landCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  infrastructureCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overheadCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  financingCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  corporateTaxRatePercent?: number;
}
