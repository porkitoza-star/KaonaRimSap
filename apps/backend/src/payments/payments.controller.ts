import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { ProposePaymentDto } from './dto/propose-payment.dto';
import { RecordReceiptDto } from './dto/record-receipt.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Post('propose')
  @Roles(Role.PROJECT_MANAGER, Role.ACCOUNTANT, Role.CFO, Role.CEO)
  propose(@Body() dto: ProposePaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.proposePayment(dto, user.userId);
  }

  @Post('receive')
  @Roles(Role.ACCOUNTANT, Role.CFO, Role.CEO)
  receive(@Body() dto: RecordReceiptDto, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.recordReceipt(dto, user.userId);
  }

  @Post(':id/approve')
  @Roles(Role.CFO, Role.CEO)
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.approve(id, user.userId, user.role as Role);
  }

  @Post(':id/reject')
  @Roles(Role.CFO, Role.CEO)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.reject(id, user.userId, user.role as Role, dto.comment);
  }
}
