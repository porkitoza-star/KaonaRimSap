import { Module } from '@nestjs/common';
import { JournalModule } from '../journal/journal.module';
import { BillsService } from './bills.service';
import { BillsController } from './bills.controller';

@Module({
  imports: [JournalModule],
  providers: [BillsService],
  controllers: [BillsController],
  exports: [BillsService],
})
export class BillsModule {}
