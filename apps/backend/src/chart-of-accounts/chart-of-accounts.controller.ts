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
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chart-of-accounts')
export class ChartOfAccountsController {
  constructor(private chartOfAccountsService: ChartOfAccountsService) {}

  @Get()
  findAll() {
    return this.chartOfAccountsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.chartOfAccountsService.findOne(id);
  }

  @Post()
  @Roles(Role.CFO, Role.CEO)
  create(@Body() dto: CreateAccountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.chartOfAccountsService.create(dto, user.userId);
  }

  @Patch(':id')
  @Roles(Role.CFO, Role.CEO)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chartOfAccountsService.update(id, dto, user.userId);
  }
}
