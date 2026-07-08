import { IsNumber, IsPositive, IsString } from 'class-validator';

export class ApplyTemplateDto {
  @IsString()
  costCenterId!: string;

  @IsNumber()
  @IsPositive()
  targetAreaSqm!: number;
}
