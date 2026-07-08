import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { FeasibilityService } from './feasibility.service';
import { UpsertFeasibilityDto } from './dto/upsert-feasibility.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('feasibility')
export class FeasibilityController {
  constructor(private feasibilityService: FeasibilityService) {}

  @Get(':costCenterId')
  findOne(@Param('costCenterId') costCenterId: string) {
    return this.feasibilityService.findByCostCenter(costCenterId);
  }

  @Put(':costCenterId')
  @Roles(Role.PROJECT_MANAGER, Role.ACCOUNTANT, Role.CFO, Role.CEO)
  upsert(
    @Param('costCenterId') costCenterId: string,
    @Body() dto: UpsertFeasibilityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feasibilityService.upsert(costCenterId, dto, user.userId);
  }
}
