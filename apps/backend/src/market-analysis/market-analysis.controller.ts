import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { MarketAnalysisService } from './market-analysis.service';
import { UpsertMarketComparableDto } from './dto/upsert-market-comparable.dto';
import { GenerateInsightsDto } from './dto/generate-insights.dto';

const MANAGE_ROLES = [Role.PROJECT_MANAGER, Role.ACCOUNTANT, Role.CFO, Role.CEO];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('market-analysis')
export class MarketAnalysisController {
  constructor(private marketAnalysisService: MarketAnalysisService) {}

  @Get('comparables')
  findComparables(@Query('costCenterId') costCenterId: string) {
    return this.marketAnalysisService.findComparables(costCenterId);
  }

  @Post('comparables')
  @Roles(...MANAGE_ROLES)
  createComparable(@Body() dto: UpsertMarketComparableDto, @CurrentUser() user: AuthenticatedUser) {
    return this.marketAnalysisService.createComparable(dto, user.userId);
  }

  @Put('comparables/:id')
  @Roles(...MANAGE_ROLES)
  updateComparable(
    @Param('id') id: string,
    @Body() dto: UpsertMarketComparableDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.marketAnalysisService.updateComparable(id, dto, user.userId);
  }

  @Delete('comparables/:id')
  @Roles(...MANAGE_ROLES)
  removeComparable(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.marketAnalysisService.removeComparable(id, user.userId);
  }

  @Get(':costCenterId/report')
  getReport(@Param('costCenterId') costCenterId: string) {
    return this.marketAnalysisService.getReport(costCenterId);
  }

  @Post(':costCenterId/generate-insights')
  @Roles(...MANAGE_ROLES)
  generateInsights(
    @Param('costCenterId') costCenterId: string,
    @Body() dto: GenerateInsightsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.marketAnalysisService.generateInsights(costCenterId, dto, user.userId);
  }
}
