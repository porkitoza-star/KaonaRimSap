import { Module } from '@nestjs/common';
import { FeasibilityService } from './feasibility.service';
import { FeasibilityController } from './feasibility.controller';

@Module({
  providers: [FeasibilityService],
  controllers: [FeasibilityController],
  exports: [FeasibilityService],
})
export class FeasibilityModule {}
