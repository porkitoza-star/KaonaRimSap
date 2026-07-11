import { Module } from '@nestjs/common';
import { BoqTemplatesModule } from '../boq-templates/boq-templates.module';
import { ConstructionPhasesModule } from '../construction-phases/construction-phases.module';
import { FeasibilityModule } from '../feasibility/feasibility.module';
import { CostEstimatorService } from './cost-estimator.service';
import { CostEstimatorController } from './cost-estimator.controller';

@Module({
  imports: [BoqTemplatesModule, ConstructionPhasesModule, FeasibilityModule],
  providers: [CostEstimatorService],
  controllers: [CostEstimatorController],
})
export class CostEstimatorModule {}
