import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { CostCentersModule } from './cost-centers/cost-centers.module';
import { ChartOfAccountsModule } from './chart-of-accounts/chart-of-accounts.module';
import { JournalModule } from './journal/journal.module';
import { ContactsModule } from './contacts/contacts.module';
import { InvoicesModule } from './invoices/invoices.module';
import { BillsModule } from './bills/bills.module';
import { DocumentsModule } from './documents/documents.module';
import { PaymentsModule } from './payments/payments.module';
import { WhtCertificatesModule } from './wht/wht-certificates.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MaterialsModule } from './materials/materials.module';
import { ConstructionPhasesModule } from './construction-phases/construction-phases.module';
import { FeasibilityModule } from './feasibility/feasibility.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    CostCentersModule,
    ChartOfAccountsModule,
    JournalModule,
    ContactsModule,
    InvoicesModule,
    BillsModule,
    DocumentsModule,
    PaymentsModule,
    WhtCertificatesModule,
    DashboardModule,
    MaterialsModule,
    ConstructionPhasesModule,
    FeasibilityModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
