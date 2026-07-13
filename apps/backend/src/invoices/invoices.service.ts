import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, ContactType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JournalService } from '../journal/journal.service';
import { buildExcelBuffer, parseExcelRows } from '../common/excel-export.util';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ReitemizeInvoiceDto } from './dto/reitemize-invoice.dto';
import { VAT_RATE, STANDARD_ACCOUNT_CODES } from '../common/constants';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function parseExcelDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value.trim());
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
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

  async reitemize(id: string, dto: ReitemizeInvoiceDto, userId: string) {
    const invoice = await this.findOne(id);
    if (invoice.status === InvoiceStatus.DRAFT || invoice.status === InvoiceStatus.VOID) {
      throw new BadRequestException(
        'ฟีเจอร์นี้ใช้ได้เฉพาะใบแจ้งหนี้ที่ออกแล้วเท่านั้น (ใบร่างแก้ไขรายการได้โดยตรง)',
      );
    }

    const newSubtotal = round2(dto.lines.reduce((sum, line) => sum + line.amount, 0));
    if (Math.round(newSubtotal * 100) !== Math.round(Number(invoice.subtotal) * 100)) {
      throw new BadRequestException(
        `ยอดรวมรายการใหม่ (${newSubtotal.toFixed(2)}) ต้องเท่ากับยอดก่อน VAT เดิมของใบแจ้งหนี้ (${Number(
          invoice.subtotal,
        ).toFixed(2)}) เพื่อไม่ให้กระทบยอดลูกหนี้และ VAT ที่บันทึกไปแล้ว`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await this.journal.postEntry(
        {
          entryDate: new Date(),
          description: `ปรับรายละเอียดรายรับใบแจ้งหนี้เลขที่ ${invoice.number} (แบ่งย่อยรายการ)`,
          sourceType: 'INVOICE_REITEMIZE',
          sourceId: invoice.id,
          createdById: userId,
          lines: [
            ...invoice.lines.map((line) => ({
              accountId: line.accountId,
              costCenterId: line.costCenterId,
              debit: Number(line.amount),
              memo: `ย้อนกลับรายการเดิม: ${line.description}`,
            })),
            ...dto.lines.map((line) => ({
              accountId: line.accountId,
              costCenterId: line.costCenterId,
              credit: line.amount,
              memo: line.description,
            })),
          ],
        },
        tx,
      );

      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      await tx.invoiceLine.createMany({
        data: dto.lines.map((line) => ({
          invoiceId: id,
          description: line.description,
          amount: line.amount,
          costCenterId: line.costCenterId,
          accountId: line.accountId,
        })),
      });

      return tx.invoice.findUniqueOrThrow({
        where: { id },
        include: { contact: true, lines: { include: { costCenter: true, account: true } } },
      });
    });

    await this.audit.log({
      userId,
      action: 'REITEMIZE',
      entityType: 'Invoice',
      entityId: id,
      before: invoice,
      after: result,
    });

    return result;
  }

  async importExcel(buffer: Buffer, userId: string) {
    const rows = parseExcelRows(buffer);
    const errors: { row: number; reason: string }[] = [];
    let createdCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // header is row 1
      try {
        const contactName = String(row['ลูกค้า'] ?? '').trim();
        const description = String(row['รายละเอียด'] ?? '').trim();
        const accountCode = String(row['รหัสบัญชี'] ?? '').trim();
        const costCenterName = String(row['ศูนย์ต้นทุน'] ?? '').trim();
        const amount = Number(row['จำนวนเงิน']);
        const issueDate = parseExcelDate(row['วันที่ออก']);

        if (!contactName) throw new Error('ไม่ได้ระบุลูกค้า');
        if (!description) throw new Error('ไม่ได้ระบุรายละเอียด');
        if (!accountCode) throw new Error('ไม่ได้ระบุรหัสบัญชี');
        if (!costCenterName) throw new Error('ไม่ได้ระบุศูนย์ต้นทุน');
        if (!amount || amount <= 0) throw new Error('จำนวนเงินต้องมากกว่า 0');
        if (!issueDate) throw new Error('วันที่ออกไม่ถูกต้อง');

        const dueDate = parseExcelDate(row['ครบกำหนด']) ?? new Date(issueDate.getTime() + 30 * 86400000);

        const account = await this.prisma.account.findUnique({ where: { code: accountCode } });
        if (!account) throw new Error(`ไม่พบรหัสบัญชี "${accountCode}"`);

        const costCenter = await this.prisma.costCenter.findFirst({
          where: { name: costCenterName },
        });
        if (!costCenter) throw new Error(`ไม่พบศูนย์ต้นทุน "${costCenterName}"`);

        let contact = await this.prisma.contact.findFirst({
          where: { name: { equals: contactName, mode: 'insensitive' } },
        });
        if (!contact) {
          contact = await this.prisma.contact.create({
            data: { name: contactName, type: ContactType.CUSTOMER },
          });
        }

        const number = String(row['เลขที่'] ?? '').trim() || `IMP-${Date.now()}-${rowNum}`;
        const subtotal = round2(amount);
        const vatAmount = round2(subtotal * VAT_RATE);
        const totalAmount = round2(subtotal + vatAmount);

        const created = await this.prisma.invoice.create({
          data: {
            number,
            contactId: contact.id,
            issueDate,
            dueDate,
            subtotal,
            vatAmount,
            totalAmount,
            status: InvoiceStatus.DRAFT,
            lines: {
              create: [{ description, amount: subtotal, costCenterId: costCenter.id, accountId: account.id }],
            },
          },
        });

        await this.audit.log({
          userId,
          action: 'IMPORT',
          entityType: 'Invoice',
          entityId: created.id,
          after: created,
        });
        createdCount++;
      } catch (err) {
        errors.push({ row: rowNum, reason: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' });
      }
    }

    return { createdCount, errors };
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
