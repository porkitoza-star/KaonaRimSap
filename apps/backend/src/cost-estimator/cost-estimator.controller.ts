import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CostEstimatorService } from './cost-estimator.service';
import { EstimateScenarioDto } from './dto/estimate-scenario.dto';
import { ApplyScenarioDto } from './dto/apply-scenario.dto';

const MANAGE_ROLES = [Role.PROJECT_MANAGER, Role.ACCOUNTANT, Role.CFO, Role.CEO];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cost-estimator')
export class CostEstimatorController {
  constructor(private costEstimatorService: CostEstimatorService) {}

  @Post('scenario')
  scenario(@Body() dto: EstimateScenarioDto) {
    return this.costEstimatorService.computeScenario(dto);
  }

  @Post('apply')
  @Roles(...MANAGE_ROLES)
  apply(@Body() dto: ApplyScenarioDto, @CurrentUser() user: AuthenticatedUser) {
    return this.costEstimatorService.applyScenario(dto, user.userId);
  }
}
