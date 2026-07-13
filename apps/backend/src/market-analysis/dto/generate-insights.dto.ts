import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class GenerateInsightsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  ownPricePerSqm?: number;

  @IsOptional()
  @IsString()
  ownPromotion?: string;
}
