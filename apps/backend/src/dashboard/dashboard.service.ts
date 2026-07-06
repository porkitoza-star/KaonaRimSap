import { Injectable } from '@nestjs/common';
import { AccountType, BillStatus, InvoiceStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { STANDARD_ACCOUNT_CODES } from '../common/constants';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

interface AgingItem {
  id: string;
  number: string;
  contactName: string;
  dueDate: Date;
  totalAmount: number;
  remaining: number;
}

interface AgingBuckets {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getCashBalance() {
    const cashAccounts = await this.prisma.account.findMany({
      where: { code: { in: ['1010', STANDARD_ACCOUNT_CODES.BANK] } },
    });
    const lines = await this.prisma.journalEntryLine.findMany({
      where: { accountId: { in: cashAccounts.map((a) => a.id) } },
    });
    const balance = round2(lines.reduce((sum, l) => sum + Number(l.debit) - Number(l.credit), 0));
    return { balance, asOf: new Date() };
  }

  private async getInvoiceRemaining(): Promise<AgingItem[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] } },
      include: { contact: true, paymentAllocations: { include: { payment: true } } },
    });
    return invoices.map((inv) => {
      const paid = inv.paymentAllocations
        .filter((a) => a.payment.status === PaymentStatus.COMPLETED)
        .reduce((sum, a) => sum + Number(a.amount), 0);
      return {
        id: inv.id,
        number: inv.number,
        contactName: inv.contact.name,
        dueDate: inv.dueDate,
        totalAmount: Number(inv.totalAmount),
        remaining: round2(Number(inv.totalAmount) - paid),
      };
    });
  }

  private async getBillRemaining(): Promise<AgingItem[]> {
    const bills = await this.prisma.bill.findMany({
      where: { status: { in: [BillStatus.CONFIRMED, BillStatus.PARTIALLY_PAID] } },
      include: { contact: true, paymentAllocations: { include: { payment: true } } },
    });
    return bills.map((bill) => {
      const paid = bill.paymentAllocations
        .filter((a) => a.payment.status === PaymentStatus.COMPLETED)
        .reduce((sum, a) => sum + Number(a.amount), 0);
      return {
        id: bill.id,
        number: bill.number,
        contactName: bill.contact.name,
        dueDate: bill.dueDate,
        totalAmount: Number(bill.totalAmount),
        remaining: round2(Number(bill.totalAmount) - paid),
      };
    });
  }

  private bucketAging(items: AgingItem[], asOf: Date): AgingBuckets {
    const buckets: AgingBuckets = {
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90: 0,
    };
    for (const item of items) {
      const daysOverdue = Math.floor((asOf.getTime() - item.dueDate.getTime()) / 86_400_000);
      if (daysOverdue <= 0) buckets.current += item.remaining;
      else if (daysOverdue <= 30) buckets.days1to30 += item.remaining;
      else if (daysOverdue <= 60) buckets.days31to60 += item.remaining;
      else if (daysOverdue <= 90) buckets.days61to90 += item.remaining;
      else buckets.over90 += item.remaining;
    }
    for (const key of Object.keys(buckets) as (keyof AgingBuckets)[]) {
      buckets[key] = round2(buckets[key]);
    }
    return buckets;
  }

  async getArAging() {
    const items = (await this.getInvoiceRemaining()).filter((i) => i.remaining > 0.01);
    const asOf = new Date();
    return { asOf, buckets: this.bucketAging(items, asOf), items };
  }

  async getApAging() {
    const items = (await this.getBillRemaining()).filter((i) => i.remaining > 0.01);
    const asOf = new Date();
    return { asOf, buckets: this.bucketAging(items, asOf), items };
  }

  async getPnlByCostCenter(from?: Date, to?: Date) {
    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        costCenterId: { not: null },
        account: { type: { in: [AccountType.REVENUE, AccountType.EXPENSE] } },
        journalEntry: { entryDate: { gte: from, lte: to } },
      },
      include: { account: true, costCenter: true },
    });

    const byCostCenter = new Map<
      string,
      { costCenterId: string; costCenterName: string; revenue: number; expense: number }
    >();
    for (const line of lines) {
      if (!line.costCenterId || !line.costCenter) continue;
      const entry = byCostCenter.get(line.costCenterId) ?? {
        costCenterId: line.costCenterId,
        costCenterName: line.costCenter.name,
        revenue: 0,
        expense: 0,
      };
      if (line.account.type === AccountType.REVENUE) {
        entry.revenue += Number(line.credit) - Number(line.debit);
      } else {
        entry.expense += Number(line.debit) - Number(line.credit);
      }
      byCostCenter.set(line.costCenterId, entry);
    }

    return Array.from(byCostCenter.values()).map((e) => ({
      ...e,
      revenue: round2(e.revenue),
      expense: round2(e.expense),
      profit: round2(e.revenue - e.expense),
    }));
  }

  async getCashFlowForecast(days = 90) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today.getTime() + days * 86_400_000);

    const [invoices, bills] = await Promise.all([this.getInvoiceRemaining(), this.getBillRemaining()]);

    const inflows = invoices.filter(
      (i) => i.dueDate >= today && i.dueDate <= horizon && i.remaining > 0.01,
    );
    const outflows = bills.filter(
      (b) => b.dueDate >= today && b.dueDate <= horizon && b.remaining > 0.01,
    );

    const totalInflow = round2(inflows.reduce((sum, i) => sum + i.remaining, 0));
    const totalOutflow = round2(outflows.reduce((sum, b) => sum + b.remaining, 0));

    return {
      from: today,
      to: horizon,
      totalInflow,
      totalOutflow,
      netCashFlow: round2(totalInflow - totalOutflow),
      inflows,
      outflows,
    };
  }
}
