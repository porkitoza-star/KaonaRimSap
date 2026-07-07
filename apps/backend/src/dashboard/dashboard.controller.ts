import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('cash-balance')
  cashBalance() {
    return this.dashboardService.getCashBalance();
  }

  @Get('ar-aging')
  arAging() {
    return this.dashboardService.getArAging();
  }

  @Get('ap-aging')
  apAging() {
    return this.dashboardService.getApAging();
  }

  @Get('pnl-by-cost-center')
  pnlByCostCenter(@Query('from') from?: string, @Query('to') to?: string) {
    return this.dashboardService.getPnlByCostCenter(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('cash-flow-forecast')
  cashFlowForecast(@Query('days') days?: string) {
    return this.dashboardService.getCashFlowForecast(days ? Number(days) : 90);
  }
}
