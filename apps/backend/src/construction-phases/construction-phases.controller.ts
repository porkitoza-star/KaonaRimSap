import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ConstructionPhasesService } from './construction-phases.service';
import { SeedPhasesDto } from './dto/seed-phases.dto';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseProgressDto } from './dto/update-phase-progress.dto';

const MANAGE_ROLES = [Role.PROJECT_MANAGER, Role.ACCOUNTANT, Role.CFO, Role.CEO];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('construction-phases')
export class ConstructionPhasesController {
  constructor(private phasesService: ConstructionPhasesService) {}

  @Get()
  findAll(@Query('costCenterId') costCenterId: string) {
    return this.phasesService.findAllForCostCenter(costCenterId);
  }

  @Post('seed-template')
  @Roles(...MANAGE_ROLES)
  seedTemplate(@Body() dto: SeedPhasesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.phasesService.seedFromTemplate(dto.costCenterId, dto.houseType, user.userId);
  }

  @Post()
  @Roles(...MANAGE_ROLES)
  create(@Body() dto: CreatePhaseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.phasesService.create(dto, user.userId);
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  updateProgress(
    @Param('id') id: string,
    @Body() dto: UpdatePhaseProgressDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.phasesService.updateProgress(id, dto, user.userId);
  }

  @Delete(':id')
  @Roles(...MANAGE_ROLES)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.phasesService.remove(id, user.userId);
  }
}
