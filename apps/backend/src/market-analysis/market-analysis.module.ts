import { Module } from '@nestjs/common';
import { MarketAnalysisService } from './market-analysis.service';
import { MarketAnalysisController } from './market-analysis.controller';

@Module({
  providers: [MarketAnalysisService],
  controllers: [MarketAnalysisController],
})
export class MarketAnalysisModule {}
