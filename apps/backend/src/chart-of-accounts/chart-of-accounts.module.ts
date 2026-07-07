import { Module } from '@nestjs/common';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { ChartOfAccountsController } from './chart-of-accounts.controller';

@Module({
  providers: [ChartOfAccountsService],
  controllers: [ChartOfAccountsController],
  exports: [ChartOfAccountsService],
})
export class ChartOfAccountsModule {}
