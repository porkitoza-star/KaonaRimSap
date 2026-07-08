import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaymentMilestonesService } from './payment-milestones.service';
import { CreatePaymentMilestoneDto } from './dto/create-payment-milestone.dto';
import { UpdatePaymentMilestoneDto } from './dto/update-payment-milestone.dto';

const MANAGE_ROLES = [Role.PROJECT_MANAGER, Role.ACCOUNTANT, Role.CFO, Role.CEO];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payment-milestones')
export class PaymentMilestonesController {
  constructor(private milestonesService: PaymentMilestonesService) {}

  @Get()
  findAll(@Query('costCenterId') costCenterId: string) {
    return this.milestonesService.findAllForCostCenter(costCenterId);
  }

  @Post()
  @Roles(...MANAGE_ROLES)
  create(@Body() dto: CreatePaymentMilestoneDto, @CurrentUser() user: AuthenticatedUser) {
    return this.milestonesService.create(dto, user.userId);
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMilestoneDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.milestonesService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @Roles(...MANAGE_ROLES)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.milestonesService.remove(id, user.userId);
  }
}
