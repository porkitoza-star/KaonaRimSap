import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { CostCentersModule } from './cost-centers/cost-centers.module';
import { ChartOfAccountsModule } from './chart-of-accounts/chart-of-accounts.module';
import { JournalModule } from './journal/journal.module';
import { ContactsModule } from './contacts/contacts.module';
import { InvoicesModule } from './invoices/invoices.module';
import { BillsModule } from './bills/bills.module';
import { DocumentsModule } from './documents/documents.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    AuthModule,
    CostCentersModule,
    ChartOfAccountsModule,
    JournalModule,
    ContactsModule,
    InvoicesModule,
    BillsModule,
    DocumentsModule,
    PaymentsModule,
  ],
})
export class AppModule {}
