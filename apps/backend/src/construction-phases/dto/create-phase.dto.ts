import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

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
  @IsString()
  notes?: string;
}
