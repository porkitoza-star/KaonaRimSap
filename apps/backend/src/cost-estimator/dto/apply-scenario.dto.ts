import { IsString } from 'class-validator';
import { EstimateScenarioDto } from './estimate-scenario.dto';

export class ApplyScenarioDto extends EstimateScenarioDto {
  @IsString()
  costCenterId!: string;
}
