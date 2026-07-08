import { Module } from '@nestjs/common';
import { BillsModule } from '../bills/bills.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { PaymentsModule } from '../payments/payments.module';
import { LedgerImportService } from './ledger-import.service';
import { LedgerImportController } from './ledger-import.controller';

@Module({
  imports: [BillsModule, InvoicesModule, PaymentsModule],
  providers: [LedgerImportService],
  controllers: [LedgerImportController],
})
export class LedgerImportModule {}
