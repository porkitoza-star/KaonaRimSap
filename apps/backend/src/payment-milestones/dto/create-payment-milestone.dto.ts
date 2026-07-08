import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreatePaymentMilestoneDto {
  @IsString()
  costCenterId!: string;

  @IsInt()
  @Min(1)
  sequence!: number;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
