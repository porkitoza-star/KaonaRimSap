import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { BoqTemplatesService } from './boq-templates.service';
import { ApplyTemplateDto } from './dto/apply-template.dto';

const MANAGE_ROLES = [Role.PROJECT_MANAGER, Role.ACCOUNTANT, Role.CFO, Role.CEO];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('boq-templates')
export class BoqTemplatesController {
  constructor(private boqTemplatesService: BoqTemplatesService) {}

  @Get()
  findAll() {
    return this.boqTemplatesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.boqTemplatesService.findOne(id);
  }

  @Get(':id/preview')
  preview(@Param('id') id: string, @Query('targetAreaSqm') targetAreaSqm: string) {
    return this.boqTemplatesService.preview(id, Number(targetAreaSqm));
  }

  @Post(':id/apply')
  @Roles(...MANAGE_ROLES)
  apply(@Param('id') id: string, @Body() dto: ApplyTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.boqTemplatesService.apply(id, dto.costCenterId, dto.targetAreaSqm, user.userId);
  }
}
