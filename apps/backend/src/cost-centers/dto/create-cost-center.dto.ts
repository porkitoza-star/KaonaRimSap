import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CostCenterType } from '@prisma/client';

export class CreateCostCenterDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(CostCenterType)
  type!: CostCenterType;

  @IsOptional()
  @IsString()
  parentId?: string;
}
