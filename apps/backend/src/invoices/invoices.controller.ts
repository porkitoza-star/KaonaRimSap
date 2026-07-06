import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Get()
  findAll() {
    return this.invoicesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Post()
  @Roles(Role.ACCOUNTANT, Role.CFO, Role.CEO)
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.create(dto, user.userId);
  }

  @Post(':id/issue')
  @Roles(Role.ACCOUNTANT, Role.CFO, Role.CEO)
  issue(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.issue(id, user.userId);
  }

  @Post(':id/void')
  @Roles(Role.ACCOUNTANT, Role.CFO, Role.CEO)
  void(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.void(id, user.userId);
  }
}
