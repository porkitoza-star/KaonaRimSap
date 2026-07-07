import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateCostCenterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
