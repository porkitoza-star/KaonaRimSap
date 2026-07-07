import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JournalService } from '../journal/journal.service';
import { buildExcelBuffer } from '../common/excel-export.util';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { VAT_RATE, STANDARD_ACCOUNT_CODES } from '../common/constants';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private journal: JournalService,
  ) {}

  findAll() {
    return this.prisma.invoice.findMany({
      include: { contact: true, lines: true },
      orderBy: { issueDate: 'desc' },
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { contact: true, lines: { include: { costCenter: true, account: true } } },
    });
    if (!invoice) {
      throw new NotFoundException('ไม่พบใบแจ้งหนี้นี้');
    }
    return invoice;
  }

  async create(dto: CreateInvoiceDto, userId: string) {
    const subtotal = round2(dto.lines.reduce((sum, line) => sum + line.amount, 0));
    const vatAmount = round2(subtotal * VAT_RATE);
    const totalAmount = round2(subtotal + vatAmount);

    const created = await this.prisma.invoice.create({
      data: {
        number: dto.number,
        contactId: dto.contactId,
        issueDate: new Date(dto.issueDate),
        dueDate: new Date(dto.dueDate),
        subtotal,
        vatAmount,
        totalAmount,
        status: InvoiceStatus.DRAFT,
        lines: {
          create: dto.lines.map((line) => ({
            description: line.description,
            amount: line.amount,
            costCenterId: line.costCenterId,
            accountId: line.accountId,
          })),
        },
      },
      include: { lines: true },
    });

    await this.audit.log({
      userId,
      action: 'CREATE',
      entityType: 'Invoice',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  async issue(id: string, userId: string) {
    const invoice = await this.findOne(id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('ออกใบแจ้งหนี้ได้เฉพาะสถานะ DRAFT เท่านั้น');
    }

    const arAccount = await this.prisma.account.findUniqueOrThrow({
      where: { code: STANDARD_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE },
    });
    const vatOutputAccount = await this.prisma.account.findUniqueOrThrow({
      where: { code: STANDARD_ACCOUNT_CODES.VAT_OUTPUT },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const entry = await this.journal.postEntry(
        {
          entryDate: invoice.issueDate,
          description: `ออกใบแจ้งหนี้เลขที่ ${invoice.number}`,
          sourceType: 'INVOICE',
          sourceId: invoice.id,
          createdById: userId,
          lines: [
            { accountId: arAccount.id, debit: Number(invoice.totalAmount) },
            ...invoice.lines.map((line) => ({
              accountId: line.accountId,
              costCenterId: line.costCenterId,
              credit: Number(line.amount),
            })),
            ...(Number(invoice.vatAmount) > 0
              ? [{ accountId: vatOutputAccount.id, credit: Number(invoice.vatAmount) }]
              : []),
          ],
        },
        tx,
      );

      const invoiceUpdated = await tx.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.SENT },
      });

      return { invoiceUpdated, entry };
    });

    await this.audit.log({
      userId,
      action: 'ISSUE',
      entityType: 'Invoice',
      entityId: id,
      before: invoice,
      after: updated.invoiceUpdated,
    });

    return updated.invoiceUpdated;
  }

  async void(id: string, userId: string) {
    const invoice = await this.findOne(id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('ยกเลิกได้เฉพาะใบแจ้งหนี้สถานะ DRAFT เท่านั้น');
    }
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.VOID },
    });
    await this.audit.log({
      userId,
      action: 'VOID',
      entityType: 'Invoice',
      entityId: id,
      before: invoice,
      after: updated,
    });
    return updated;
  }

  async exportExcel() {
    const invoices = await this.prisma.invoice.findMany({
      include: { contact: true },
      orderBy: { issueDate: 'desc' },
    });
    return buildExcelBuffer(
      'Invoices',
      [
        { header: 'เลขที่', value: (r: (typeof invoices)[number]) => r.number },
        { header: 'ลูกค้า', value: (r: (typeof invoices)[number]) => r.contact.name },
        { header: 'วันที่ออก', value: (r: (typeof invoices)[number]) => r.issueDate.toISOString().slice(0, 10) },
        { header: 'ครบกำหนด', value: (r: (typeof invoices)[number]) => r.dueDate.toISOString().slice(0, 10) },
        { header: 'ยอดก่อน VAT', value: (r: (typeof invoices)[number]) => Number(r.subtotal) },
        { header: 'VAT', value: (r: (typeof invoices)[number]) => Number(r.vatAmount) },
        { header: 'ยอดรวม', value: (r: (typeof invoices)[number]) => Number(r.totalAmount) },
        { header: 'สถานะ', value: (r: (typeof invoices)[number]) => r.status },
      ],
      invoices,
    );
  }
}
