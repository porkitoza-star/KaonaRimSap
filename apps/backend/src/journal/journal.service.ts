import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface JournalLineInput {
  accountId: string;
  costCenterId?: string;
  debit?: number;
  credit?: number;
  memo?: string;
}

export interface PostJournalEntryInput {
  entryDate: Date;
  description: string;
  sourceType: string;
  sourceId?: string;
  createdById: string;
  lines: JournalLineInput[];
}

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient;

@Injectable()
export class JournalService {
  constructor(private prisma: PrismaService) {}

  async postEntry(input: PostJournalEntryInput, tx?: PrismaClientOrTx) {
    const client = tx ?? this.prisma;

    if (input.lines.length < 2) {
      throw new BadRequestException('รายการบันทึกบัญชีต้องมีอย่างน้อย 2 บรรทัด');
    }

    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of input.lines) {
      const debit = line.debit ?? 0;
      const credit = line.credit ?? 0;
      if (debit > 0 && credit > 0) {
        throw new BadRequestException('แต่ละบรรทัดต้องมีค่าเดบิตหรือเครดิตเพียงอย่างเดียว');
      }
      if (debit === 0 && credit === 0) {
        throw new BadRequestException('แต่ละบรรทัดต้องมีค่าเดบิตหรือเครดิตมากกว่าศูนย์');
      }
      totalDebit += debit;
      totalCredit += credit;
    }

    // Compare in satang (cents) to avoid floating point drift.
    const roundedDebit = Math.round(totalDebit * 100);
    const roundedCredit = Math.round(totalCredit * 100);
    if (roundedDebit !== roundedCredit) {
      throw new BadRequestException(
        `ยอดเดบิต (${totalDebit.toFixed(2)}) ไม่เท่ากับยอดเครดิต (${totalCredit.toFixed(2)})`,
      );
    }

    return client.journalEntry.create({
      data: {
        entryDate: input.entryDate,
        description: input.description,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        createdById: input.createdById,
        lines: {
          create: input.lines.map((line) => ({
            accountId: line.accountId,
            costCenterId: line.costCenterId,
            debit: line.debit ?? 0,
            credit: line.credit ?? 0,
            memo: line.memo,
          })),
        },
      },
      include: { lines: true },
    });
  }

  findAll(filter?: { costCenterId?: string; accountId?: string }) {
    return this.prisma.journalEntry.findMany({
      where: {
        lines: {
          some: {
            costCenterId: filter?.costCenterId,
            accountId: filter?.accountId,
          },
        },
      },
      include: { lines: { include: { account: true, costCenter: true } } },
      orderBy: { entryDate: 'desc' },
    });
  }
}
