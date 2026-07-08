import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class MilestonePercentInput {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber()
  @Min(0.01)
  percent!: number;

  @IsOptional()
  @IsDateString()
  plannedDate?: string;
}

export class GenerateMilestonesDto {
  @IsString()
  costCenterId!: string;

  @IsNumber()
  @Min(0.01)
  totalContractValue!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MilestonePercentInput)
  milestones!: MilestonePercentInput[];
}
