import { Injectable, Logger } from '@nestjs/common';
import { ContactType, CostCenterType, PaymentStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillsService } from '../bills/bills.service';
import { InvoicesService } from '../invoices/invoices.service';
import { PaymentsService } from '../payments/payments.service';
import { VAT_RATE } from '../common/constants';
import {
  parseLedgerWorkbook,
  resolveHouseInfo,
  resolveExpenseContactName,
  resolveIncomeContactName,
} from './ledger-parser';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

interface Caches {
  costCenters: Map<string, string>;
  contacts: Map<string, string>;
}

const CONSTRUCTION_COST_ACCOUNT_CODE = '5010';
const REVENUE_ACCOUNT_CODE = '4010';

@Injectable()
export class LedgerImportService {
  private readonly logger = new Logger(LedgerImportService.name);

  constructor(
    private prisma: PrismaService,
    private billsService: BillsService,
    private invoicesService: InvoicesService,
    private paymentsService: PaymentsService,
  ) {}

  preview(buffer: Buffer) {
    const parsed = parseLedgerWorkbook(buffer);

    const houseKeys = new Map<string, ReturnType<typeof resolveHouseInfo>>();
    for (const b of parsed.bills) {
      const info = resolveHouseInfo(b.house);
      houseKeys.set(info.key, info);
    }
    for (const i of parsed.invoices) {
      const info = resolveHouseInfo(i.house);
      houseKeys.set(info.key, info);
    }

    return {
      billCount: parsed.bills.length,
      invoiceCount: parsed.invoices.length,
      totalBillAmount: round2(parsed.bills.reduce((sum, b) => sum + b.amount, 0)),
      totalInvoiceAmount: round2(parsed.invoices.reduce((sum, i) => sum + i.amount, 0)),
      costCentersToCreate: [...houseKeys.values()].map((c) => ({ name: c.name, type: c.type })),
      skippedCount: parsed.skipped.length,
      errorCount: parsed.errors.length,
      skipped: parsed.skipped,
      errors: parsed.errors,
      sampleBills: parsed.bills.slice(0, 15).map((b) => ({
        date: b.date,
        house: b.house,
        category: b.category,
        amount: b.amount,
        description: b.descriptions[0],
      })),
      sampleInvoices: parsed.invoices.slice(0, 15).map((i) => ({
        date: i.date,
        house: i.house,
        amount: i.amount,
        description: i.description,
      })),
    };
  }

  private async getOrCreateCostCenter(caches: Caches, houseRaw: string): Promise<string> {
    const info = resolveHouseInfo(houseRaw);
    const cached = caches.costCenters.get(info.key);
    if (cached) return cached;
    let cc = await this.prisma.costCenter.findFirst({ where: { name: info.name } });
    if (!cc) {
      cc = await this.prisma.costCenter.create({
        data: { name: info.name, type: info.type as CostCenterType },
      });
    }
    caches.costCenters.set(info.key, cc.id);
    return cc.id;
  }

  private async getOrCreateContact(caches: Caches, name: string, type: ContactType): Promise<string> {
    const cacheKey = `${type}:${name}`;
    const cached = caches.contacts.get(cacheKey);
    if (cached) return cached;
    let contact = await this.prisma.contact.findFirst({ where: { name, type } });
    if (!contact) {
      contact = await this.prisma.contact.create({ data: { name, type } });
    }
    caches.contacts.set(cacheKey, contact.id);
    return contact.id;
  }

  async commit(buffer: Buffer, userId: string) {
    const parsed = parseLedgerWorkbook(buffer);
    const caches: Caches = { costCenters: new Map(), contacts: new Map() };

    const constructionAccount = await this.prisma.account.findUniqueOrThrow({
      where: { code: CONSTRUCTION_COST_ACCOUNT_CODE },
    });
    const revenueAccount = await this.prisma.account.findUniqueOrThrow({
      where: { code: REVENUE_ACCOUNT_CODE },
    });

    const runErrors: { context: string; reason: string }[] = parsed.errors.map((e) => ({
      context: `${e.sheet} แถว ${e.row}`,
      reason: e.reason,
    }));

    let billCounter = 0;
    let createdBills = 0;
    for (const b of parsed.bills) {
      billCounter++;
      try {
        const costCenterId = await this.getOrCreateCostCenter(caches, b.house);
        const contactName = resolveExpenseContactName(b.method);
        const contactId = await this.getOrCreateContact(caches, contactName, ContactType.SUPPLIER);
        const dateIso = (b.date ?? new Date()).toISOString();

        const created = await this.billsService.create(
          {
            number: `LEDGER-${b.sheetName.slice(0, 8)}-B${billCounter}`,
            contactId,
            issueDate: dateIso,
            dueDate: dateIso,
            vatAmount: 0,
            lines: [
              {
                description: b.descriptions.slice(0, 3).join('; ').slice(0, 490),
                amount: b.amount,
                costCenterId,
                accountId: constructionAccount.id,
                workCategory: b.category || undefined,
              },
            ],
          },
          userId,
        );
        const confirmed = await this.billsService.confirm(created.id, userId);

        // Historical money already changed hands — settle it immediately so
        // AR/AP aging and cash balance reflect reality instead of showing it
        // as still outstanding.
        const proposed = await this.paymentsService.proposePayment(
          {
            amount: Number(confirmed.totalAmount),
            method: 'นำเข้าจาก Excel (ข้อมูลย้อนหลัง)',
            allocations: [{ billId: confirmed.id, amount: Number(confirmed.totalAmount) }],
          },
          userId,
        );
        let paymentId = proposed.id;
        let paymentStatus: PaymentStatus = proposed.status;
        while (
          paymentStatus === PaymentStatus.PENDING_CFO_APPROVAL ||
          paymentStatus === PaymentStatus.PENDING_CEO_APPROVAL
        ) {
          const approved = await this.paymentsService.approve(paymentId, userId, Role.CEO);
          paymentId = approved.id;
          paymentStatus = approved.status;
        }

        createdBills++;
      } catch (err) {
        this.logger.warn(`Failed to import bill row ${b.sourceRow} (${b.sheetName}): ${err}`);
        runErrors.push({
          context: `${b.sheetName} แถว ${b.sourceRow}`,
          reason: err instanceof Error ? err.message : 'สร้างบิลไม่สำเร็จ',
        });
      }
    }

    let invoiceCounter = 0;
    let createdInvoices = 0;
    for (const inv of parsed.invoices) {
      invoiceCounter++;
      try {
        const costCenterId = await this.getOrCreateCostCenter(caches, inv.house);
        const contactName = resolveIncomeContactName(inv.description);
        const contactId = await this.getOrCreateContact(caches, contactName, ContactType.CUSTOMER);
        const dateIso = (inv.date ?? new Date()).toISOString();
        const subtotal = round2(inv.amount / (1 + VAT_RATE));

        const created = await this.invoicesService.create(
          {
            number: `LEDGER-${inv.sheetName.slice(0, 8)}-I${invoiceCounter}`,
            contactId,
            issueDate: dateIso,
            dueDate: dateIso,
            lines: [
              {
                description: inv.description.slice(0, 490),
                amount: subtotal,
                costCenterId,
                accountId: revenueAccount.id,
              },
            ],
          },
          userId,
        );
        const issued = await this.invoicesService.issue(created.id, userId);

        await this.paymentsService.recordReceipt(
          {
            amount: Number(issued.totalAmount),
            method: 'นำเข้าจาก Excel (ข้อมูลย้อนหลัง)',
            allocations: [{ invoiceId: issued.id, amount: Number(issued.totalAmount) }],
          },
          userId,
        );

        createdInvoices++;
      } catch (err) {
        this.logger.warn(`Failed to import invoice row ${inv.sourceRow} (${inv.sheetName}): ${err}`);
        runErrors.push({
          context: `${inv.sheetName} แถว ${inv.sourceRow}`,
          reason: err instanceof Error ? err.message : 'สร้างใบแจ้งหนี้ไม่สำเร็จ',
        });
      }
    }

    return {
      createdBills,
      createdInvoices,
      costCentersCreated: caches.costCenters.size,
      contactsCreated: caches.contacts.size,
      skipped: parsed.skipped.length,
      errors: runErrors,
    };
  }
}
