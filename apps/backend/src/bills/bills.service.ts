import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillStatus, ContactType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JournalService } from '../journal/journal.service';
import { buildExcelBuffer, parseExcelRows } from '../common/excel-export.util';
import { CreateBillDto } from './dto/create-bill.dto';
import { STANDARD_ACCOUNT_CODES } from '../common/constants';

function parseExcelDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value.trim());
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class BillsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private journal: JournalService,
  ) {}

  findAll() {
    return this.prisma.bill.findMany({
      include: { contact: true, lines: true },
      orderBy: { issueDate: 'desc' },
    });
  }

  async findOne(id: string) {
    const bill = await this.prisma.bill.findUnique({
      where: { id },
      include: { contact: true, lines: { include: { costCenter: true, account: true } } },
    });
    if (!bill) {
      throw new NotFoundException('ไม่พบบิลนี้');
    }
    return bill;
  }

  async create(dto: CreateBillDto, userId: string) {
    const subtotal = round2(dto.lines.reduce((sum, line) => sum + line.amount, 0));
    const vatAmount = round2(dto.vatAmount);
    const whtAmount = round2(dto.whtAmount ?? 0);
    const totalAmount = round2(subtotal + vatAmount);

    const created = await this.prisma.bill.create({
      data: {
        number: dto.number,
        contactId: dto.contactId,
        issueDate: new Date(dto.issueDate),
        dueDate: new Date(dto.dueDate),
        subtotal,
        vatAmount,
        whtAmount,
        totalAmount,
        status: BillStatus.DRAFT,
        lines: {
          create: dto.lines.map((line) => ({
            description: line.description,
            amount: line.amount,
            costCenterId: line.costCenterId,
            accountId: line.accountId,
            workCategory: line.workCategory,
          })),
        },
      },
      include: { lines: true },
    });

    await this.audit.log({
      userId,
      action: 'CREATE',
      entityType: 'Bill',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  async confirm(id: string, userId: string) {
    const bill = await this.findOne(id);
    if (bill.status !== BillStatus.DRAFT) {
      throw new BadRequestException('ยืนยันได้เฉพาะบิลสถานะ DRAFT เท่านั้น');
    }

    const apAccount = await this.prisma.account.findUniqueOrThrow({
      where: { code: STANDARD_ACCOUNT_CODES.ACCOUNTS_PAYABLE },
    });
    const vatInputAccount = await this.prisma.account.findUniqueOrThrow({
      where: { code: STANDARD_ACCOUNT_CODES.VAT_INPUT },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const entry = await this.journal.postEntry(
        {
          entryDate: bill.issueDate,
          description: `ยืนยันบิลเลขที่ ${bill.number}`,
          sourceType: 'BILL',
          sourceId: bill.id,
          createdById: userId,
          lines: [
            ...bill.lines.map((line) => ({
              accountId: line.accountId,
              costCenterId: line.costCenterId,
              debit: Number(line.amount),
            })),
            ...(Number(bill.vatAmount) > 0
              ? [{ accountId: vatInputAccount.id, debit: Number(bill.vatAmount) }]
              : []),
            { accountId: apAccount.id, credit: Number(bill.totalAmount) },
          ],
        },
        tx,
      );

      const billUpdated = await tx.bill.update({
        where: { id },
        data: { status: BillStatus.CONFIRMED },
      });

      return { billUpdated, entry };
    });

    await this.audit.log({
      userId,
      action: 'CONFIRM',
      entityType: 'Bill',
      entityId: id,
      before: bill,
      after: result.billUpdated,
    });

    return result.billUpdated;
  }

  async void(id: string, userId: string) {
    const bill = await this.findOne(id);
    if (bill.status !== BillStatus.DRAFT) {
      throw new BadRequestException('ยกเลิกได้เฉพาะบิลสถานะ DRAFT เท่านั้น');
    }
    const updated = await this.prisma.bill.update({
      where: { id },
      data: { status: BillStatus.VOID },
    });
    await this.audit.log({
      userId,
      action: 'VOID',
      entityType: 'Bill',
      entityId: id,
      before: bill,
      after: updated,
    });
    return updated;
  }

  async importExcel(buffer: Buffer, userId: string) {
    const rows = parseExcelRows(buffer);
    const errors: { row: number; reason: string }[] = [];
    let createdCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // header is row 1
      try {
        const contactName = String(row['คู่ค้า'] ?? '').trim();
        const description = String(row['รายละเอียด'] ?? '').trim();
        const accountCode = String(row['รหัสบัญชี'] ?? '').trim();
        const costCenterName = String(row['ศูนย์ต้นทุน'] ?? '').trim();
        const amount = Number(row['จำนวนเงิน']);
        const issueDate = parseExcelDate(row['วันที่ออก']);

        if (!contactName) throw new Error('ไม่ได้ระบุคู่ค้า');
        if (!description) throw new Error('ไม่ได้ระบุรายละเอียด');
        if (!accountCode) throw new Error('ไม่ได้ระบุรหัสบัญชี');
        if (!costCenterName) throw new Error('ไม่ได้ระบุศูนย์ต้นทุน');
        if (!amount || amount <= 0) throw new Error('จำนวนเงินต้องมากกว่า 0');
        if (!issueDate) throw new Error('วันที่ออกไม่ถูกต้อง');

        const dueDate = parseExcelDate(row['ครบกำหนด']) ?? new Date(issueDate.getTime() + 30 * 86400000);
        const vatAmount = Number(row['VAT'] ?? 0) || 0;
        const whtAmount = Number(row['หัก ณ ที่จ่าย'] ?? 0) || 0;

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
            data: { name: contactName, type: ContactType.SUPPLIER },
          });
        }

        const number = String(row['เลขที่'] ?? '').trim() || `IMP-${Date.now()}-${rowNum}`;
        const subtotal = round2(amount);
        const totalAmount = round2(subtotal + vatAmount);

        const created = await this.prisma.bill.create({
          data: {
            number,
            contactId: contact.id,
            issueDate,
            dueDate,
            subtotal,
            vatAmount,
            whtAmount,
            totalAmount,
            status: BillStatus.DRAFT,
            lines: {
              create: [{ description, amount: subtotal, costCenterId: costCenter.id, accountId: account.id }],
            },
          },
        });

        await this.audit.log({
          userId,
          action: 'IMPORT',
          entityType: 'Bill',
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
    const bills = await this.prisma.bill.findMany({
      include: { contact: true },
      orderBy: { issueDate: 'desc' },
    });
    return buildExcelBuffer(
      'Bills',
      [
        { header: 'เลขที่', value: (r: (typeof bills)[number]) => r.number },
        { header: 'คู่ค้า', value: (r: (typeof bills)[number]) => r.contact.name },
        { header: 'วันที่ออก', value: (r: (typeof bills)[number]) => r.issueDate.toISOString().slice(0, 10) },
        { header: 'ครบกำหนด', value: (r: (typeof bills)[number]) => r.dueDate.toISOString().slice(0, 10) },
        { header: 'ยอดก่อน VAT', value: (r: (typeof bills)[number]) => Number(r.subtotal) },
        { header: 'VAT', value: (r: (typeof bills)[number]) => Number(r.vatAmount) },
        { header: 'หัก ณ ที่จ่าย', value: (r: (typeof bills)[number]) => Number(r.whtAmount) },
        { header: 'ยอดรวม', value: (r: (typeof bills)[number]) => Number(r.totalAmount) },
        { header: 'สถานะ', value: (r: (typeof bills)[number]) => r.status },
      ],
      bills,
    );
  }
}
