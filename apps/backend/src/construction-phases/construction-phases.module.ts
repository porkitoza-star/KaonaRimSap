import { Module } from '@nestjs/common';
import { ConstructionPhasesService } from './construction-phases.service';
import { ConstructionPhasesController } from './construction-phases.controller';

@Module({
  providers: [ConstructionPhasesService],
  controllers: [ConstructionPhasesController],
})
export class ConstructionPhasesModule {}
