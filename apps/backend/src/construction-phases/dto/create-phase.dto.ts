import { IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreatePhaseDto {
  @IsString()
  costCenterId!: string;

  @IsInt()
  @Min(1)
  sequence!: number;

  @IsString()
  @MinLength(1)
  category!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  contractValue?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
