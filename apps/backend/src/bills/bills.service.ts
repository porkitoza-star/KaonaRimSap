import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JournalService } from '../journal/journal.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { STANDARD_ACCOUNT_CODES } from '../common/constants';

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
}
