import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { WhtCertificatesService } from './wht-certificates.service';
import { CreateWhtCertificateDto } from './dto/create-wht-certificate.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('wht-certificates')
export class WhtCertificatesController {
  constructor(private whtCertificatesService: WhtCertificatesService) {}

  @Get()
  findAll() {
    return this.whtCertificatesService.findAll();
  }

  @Get('export')
  async export(@Query('year') year: string | undefined, @Res() res: Response) {
    const buffer = await this.whtCertificatesService.exportExcel(year ? Number(year) : undefined);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="wht-certificates.xlsx"');
    res.send(buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.whtCertificatesService.findOne(id);
  }

  @Post()
  @Roles(Role.ACCOUNTANT, Role.CFO, Role.CEO)
  create(@Body() dto: CreateWhtCertificateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.whtCertificatesService.create(dto, user.userId);
  }
}
