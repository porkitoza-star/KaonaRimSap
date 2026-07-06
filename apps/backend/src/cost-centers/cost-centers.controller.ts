import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CostCentersService } from './cost-centers.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cost-centers')
export class CostCentersController {
  constructor(private costCentersService: CostCentersService) {}

  @Get()
  findAll() {
    return this.costCentersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.costCentersService.findOne(id);
  }

  @Post()
  @Roles(Role.CFO, Role.CEO)
  create(@Body() dto: CreateCostCenterDto, @CurrentUser() user: AuthenticatedUser) {
    return this.costCentersService.create(dto, user.userId);
  }

  @Patch(':id')
  @Roles(Role.CFO, Role.CEO)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCostCenterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.costCentersService.update(id, dto, user.userId);
  }
}
