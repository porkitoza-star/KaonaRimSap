import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { BillsService } from './bills.service';
import { CreateBillDto } from './dto/create-bill.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bills')
export class BillsController {
  constructor(private billsService: BillsService) {}

  @Get()
  findAll() {
    return this.billsService.findAll();
  }

  @Get('export')
  async export(@Res() res: Response) {
    const buffer = await this.billsService.exportExcel();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="bills.xlsx"');
    res.send(buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.billsService.findOne(id);
  }

  @Post()
  @Roles(Role.ACCOUNTANT, Role.CFO, Role.CEO)
  create(@Body() dto: CreateBillDto, @CurrentUser() user: AuthenticatedUser) {
    return this.billsService.create(dto, user.userId);
  }

  @Post(':id/confirm')
  @Roles(Role.ACCOUNTANT, Role.CFO, Role.CEO)
  confirm(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.billsService.confirm(id, user.userId);
  }

  @Post(':id/void')
  @Roles(Role.ACCOUNTANT, Role.CFO, Role.CEO)
  void(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.billsService.void(id, user.userId);
  }
}
