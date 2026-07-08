import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { MaterialsService } from './materials.service';
import { CreateMaterialItemDto } from './dto/create-material-item.dto';
import { UpdateMaterialItemDto } from './dto/update-material-item.dto';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';

const MANAGE_ROLES = [Role.PROJECT_MANAGER, Role.ACCOUNTANT, Role.CFO, Role.CEO];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('materials')
export class MaterialsController {
  constructor(private materialsService: MaterialsService) {}

  @Get()
  findAll(@Query('costCenterId') costCenterId?: string) {
    return this.materialsService.findAll(costCenterId);
  }

  @Get('low-stock')
  findLowStock() {
    return this.materialsService.findLowStock();
  }

  @Get('boq-value')
  getBoqValueForProject(@Query('projectCostCenterId') projectCostCenterId: string) {
    return this.materialsService.getBoqValueForProject(projectCostCenterId);
  }

  @Get('export')
  async export(@Res() res: Response) {
    const buffer = await this.materialsService.exportExcel();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="materials.xlsx"');
    res.send(buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.materialsService.findOne(id);
  }

  @Post()
  @Roles(...MANAGE_ROLES)
  create(@Body() dto: CreateMaterialItemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.materialsService.create(dto, user.userId);
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMaterialItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialsService.update(id, dto, user.userId);
  }

  @Post(':id/transactions')
  @Roles(...MANAGE_ROLES)
  addTransaction(
    @Param('id') id: string,
    @Body() dto: CreateStockTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialsService.addTransaction(id, dto, user.userId);
  }
}
