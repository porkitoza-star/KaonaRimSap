import { IsIn, IsString } from 'class-validator';
import { HouseTemplateType } from '../phase-templates';

export class SeedPhasesDto {
  @IsString()
  costCenterId!: string;

  @IsIn(['SINGLE_STORY', 'TWO_STORY'])
  houseType!: HouseTemplateType;
}
