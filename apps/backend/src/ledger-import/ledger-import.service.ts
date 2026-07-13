import { Injectable, Logger } from '@nestjs/common';
import { BillStatus, ContactType, CostCenterType, InvoiceStatus, Prisma, PaymentStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillsService } from '../bills/bills.service';
import { InvoicesService } from '../invoices/invoices.service';
import { PaymentsService } from '../payments/payments.service';
import { VAT_RATE } from '../common/constants';
import {
  parseLedgerWorkbook,
  parseSupplierInvoices,
  resolveHouseInfo,
  resolveExpenseContactName,
  resolveIncomeContactName,
  type ParsedBillGroup,
  type ParsedInvoiceRow,
} from './ledger-parser';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// Prisma sends a plain JS `number` to a Decimal column using its full,
// imprecise binary float value (e.g. 614556.07 is actually stored in IEEE754
// as 614556.069999999948777...), which silently fails to match the exact
// value Postgres has on file. Comparing Decimal columns for equality must
// go through Prisma.Decimal built from the fixed 2-decimal string instead.
function decimalEq(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(2));
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

  async preview(buffer: Buffer) {
    const parsed = parseLedgerWorkbook(buffer);
    const supplierInvoices = parseSupplierInvoices(buffer);

    const houseKeys = new Map<string, ReturnType<typeof resolveHouseInfo>>();
    for (const b of parsed.bills) {
      const info = resolveHouseInfo(b.house);
      houseKeys.set(info.key, info);
    }
    for (const i of parsed.invoices) {
      const info = resolveHouseInfo(i.house);
      houseKeys.set(info.key, info);
    }

    const materialInvoices = supplierInvoices.invoices.filter((i) => i.type === 'MATERIAL');
    const laborInvoices = supplierInvoices.invoices.filter((i) => i.type === 'LABOR');

    const [duplicateBillCount, duplicateInvoiceCount] = await Promise.all([
      this.countDuplicateBills(parsed.bills),
      this.countDuplicateInvoices(parsed.invoices),
    ]);

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
      materialInvoiceCount: materialInvoices.length,
      laborInvoiceCount: laborInvoices.length,
      totalMaterialAmount: round2(materialInvoices.reduce((sum, i) => sum + i.totalAmount, 0)),
      totalLaborAmount: round2(laborInvoices.reduce((sum, i) => sum + i.totalAmount, 0)),
      supplierInvoiceSkippedCount: supplierInvoices.skipped.length,
      // Pre-checked against already-imported data so the business owner sees
      // "X of these look like duplicates" before deciding to commit, instead
      // of only finding out afterward.
      duplicateBillCount,
      duplicateInvoiceCount,
    };
  }

  // Read-only lookup — never creates a cost center. If it doesn't exist yet,
  // the row can't possibly be a duplicate of something already imported.
  private async findExistingCostCenterId(houseRaw: string): Promise<string | null> {
    const info = resolveHouseInfo(houseRaw);
    const cc = await this.prisma.costCenter.findFirst({ where: { name: info.name } });
    return cc?.id ?? null;
  }

  private async countDuplicateBills(bills: ParsedBillGroup[]): Promise<number> {
    let count = 0;
    for (const b of bills) {
      const costCenterId = await this.findExistingCostCenterId(b.house);
      if (!costCenterId) continue;
      const description = b.descriptions.slice(0, 3).join('; ').slice(0, 490);
      const existing = await this.prisma.billLine.findFirst({
        where: { costCenterId, description, amount: decimalEq(b.amount), bill: { status: { not: BillStatus.VOID } } },
      });
      if (existing) count++;
    }
    return count;
  }

  private async countDuplicateInvoices(invoices: ParsedInvoiceRow[]): Promise<number> {
    let count = 0;
    for (const inv of invoices) {
      const costCenterId = await this.findExistingCostCenterId(inv.house);
      if (!costCenterId) continue;
      const subtotal = round2(inv.amount / (1 + VAT_RATE));
      const description = inv.description.slice(0, 490);
      const existing = await this.prisma.invoiceLine.findFirst({
        where: {
          costCenterId,
          description,
          amount: decimalEq(subtotal),
          invoice: { status: { not: InvoiceStatus.VOID } },
        },
      });
      if (existing) count++;
    }
    return count;
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

  async commit(buffer: Buffer, userId: string, fileName: string, forceDuplicates = false) {
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

    let createdBills = 0;
    let duplicateBills = 0;
    for (const b of parsed.bills) {
      try {
        const costCenterId = await this.getOrCreateCostCenter(caches, b.house);
        const description = b.descriptions.slice(0, 3).join('; ').slice(0, 490);

        // Re-importing the same (or an overlapping) ledger sheet must never
        // double-book the same expense — match on the exact combination of
        // cost center + line description + amount that a re-run of this
        // same row would always produce, regardless of date.
        const existingBillLine = await this.prisma.billLine.findFirst({
          where: {
            costCenterId,
            description,
            amount: decimalEq(b.amount),
            bill: { status: { not: BillStatus.VOID } },
          },
        });
        if (existingBillLine) {
          duplicateBills++;
          if (!forceDuplicates) continue;
        }

        const contactName = resolveExpenseContactName(b.method);
        const contactId = await this.getOrCreateContact(caches, contactName, ContactType.SUPPLIER);
        const dateIso = (b.date ?? new Date()).toISOString();
        // A forced duplicate would otherwise collide with the original
        // row's number (both derive from the same sourceRow) — suffix it
        // so both can coexist.
        const numberSuffix = existingBillLine ? `-DUP${Date.now()}${Math.random().toString(36).slice(2, 6)}` : '';

        const created = await this.billsService.create(
          {
            number: `LEDGER-${b.sheetName.slice(0, 8)}-B${b.sourceRow}${numberSuffix}`,
            contactId,
            issueDate: dateIso,
            dueDate: dateIso,
            vatAmount: 0,
            lines: [
              {
                description,
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

    let createdInvoices = 0;
    let duplicateInvoices = 0;
    for (const inv of parsed.invoices) {
      try {
        const costCenterId = await this.getOrCreateCostCenter(caches, inv.house);
        const subtotal = round2(inv.amount / (1 + VAT_RATE));
        const description = inv.description.slice(0, 490);

        // Same idempotency guard as bills — a re-run of this exact row must
        // never double-book the same revenue.
        const existingInvoiceLine = await this.prisma.invoiceLine.findFirst({
          where: {
            costCenterId,
            description,
            amount: decimalEq(subtotal),
            invoice: { status: { not: InvoiceStatus.VOID } },
          },
        });
        if (existingInvoiceLine) {
          duplicateInvoices++;
          if (!forceDuplicates) continue;
        }

        const contactName = resolveIncomeContactName(inv.description);
        const contactId = await this.getOrCreateContact(caches, contactName, ContactType.CUSTOMER);
        const dateIso = (inv.date ?? new Date()).toISOString();
        const numberSuffix = existingInvoiceLine ? `-DUP${Date.now()}${Math.random().toString(36).slice(2, 6)}` : '';

        const created = await this.invoicesService.create(
          {
            number: `LEDGER-${inv.sheetName.slice(0, 8)}-I${inv.sourceRow}${numberSuffix}`,
            contactId,
            issueDate: dateIso,
            dueDate: dateIso,
            lines: [
              {
                description,
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

    const supplierInvoices = parseSupplierInvoices(buffer);
    let createdSupplierInvoices = 0;
    let duplicateSupplierInvoices = 0;
    for (const inv of supplierInvoices.invoices) {
      try {
        const existing = await this.prisma.supplierInvoiceRecord.findFirst({
          where: {
            type: inv.type,
            invoiceDate: inv.invoiceDate,
            supplierName: inv.supplierName,
            totalAmount: decimalEq(inv.totalAmount),
          },
        });
        if (existing) {
          duplicateSupplierInvoices++;
          if (!forceDuplicates) continue;
        }
        await this.prisma.supplierInvoiceRecord.create({
          data: {
            type: inv.type,
            invoiceDate: inv.invoiceDate,
            supplierName: inv.supplierName,
            taxId: inv.taxId,
            invoiceNumber: inv.invoiceNumber,
            subtotal: inv.subtotal,
            taxAmount: inv.taxAmount,
            totalAmount: inv.totalAmount,
            sourceSheet: inv.sourceSheet,
          },
        });
        createdSupplierInvoices++;
      } catch (err) {
        this.logger.warn(`Failed to import supplier invoice row ${inv.sourceRow} (${inv.sourceSheet}): ${err}`);
        runErrors.push({
          context: `${inv.sourceSheet} แถว ${inv.sourceRow}`,
          reason: err instanceof Error ? err.message : 'บันทึกใบแจ้งหนี้ผู้จำหน่ายไม่สำเร็จ',
        });
      }
    }

    // Keep a permanent record of this upload — the raw parsed rows plus the
    // resulting counts — so past imports have a history without needing the
    // original file again, and so future uploads can be checked against it.
    await this.prisma.ledgerImportLog.create({
      data: {
        fileName,
        uploadedById: userId,
        billCount: createdBills,
        invoiceCount: createdInvoices,
        duplicateBillCount: duplicateBills,
        duplicateInvoiceCount: duplicateInvoices,
        forcedDuplicates: forceDuplicates,
        rawDataJson: {
          bills: parsed.bills.map((b) => ({
            date: b.date?.toISOString() ?? null,
            house: b.house,
            category: b.category,
            amount: b.amount,
            descriptions: b.descriptions,
            sheetName: b.sheetName,
            sourceRow: b.sourceRow,
          })),
          invoices: parsed.invoices.map((i) => ({
            date: i.date?.toISOString() ?? null,
            house: i.house,
            amount: i.amount,
            description: i.description,
            sheetName: i.sheetName,
            sourceRow: i.sourceRow,
          })),
        },
      },
    });

    return {
      createdBills,
      createdInvoices,
      duplicateBills,
      duplicateInvoices,
      costCentersCreated: caches.costCenters.size,
      contactsCreated: caches.contacts.size,
      skipped: parsed.skipped.length,
      createdSupplierInvoices,
      duplicateSupplierInvoices,
      errors: runErrors,
    };
  }

  async listImportHistory() {
    return this.prisma.ledgerImportLog.findMany({
      select: {
        id: true,
        fileName: true,
        uploadedAt: true,
        billCount: true,
        invoiceCount: true,
        duplicateBillCount: true,
        duplicateInvoiceCount: true,
        forcedDuplicates: true,
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }
}
