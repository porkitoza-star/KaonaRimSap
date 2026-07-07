import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { buildExcelBuffer } from '../common/excel-export.util';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class ChartOfAccountsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.account.findMany({
      orderBy: { code: 'asc' },
      include: { children: true },
    });
  }

  async findOne(id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: { children: true, parent: true },
    });
    if (!account) {
      throw new NotFoundException('ไม่พบผังบัญชีนี้');
    }
    return account;
  }

  async create(dto: CreateAccountDto, userId: string) {
    try {
      const created = await this.prisma.account.create({ data: dto });
      await this.audit.log({
        userId,
        action: 'CREATE',
        entityType: 'Account',
        entityId: created.id,
        after: created,
      });
      return created;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('รหัสบัญชีนี้ถูกใช้งานแล้ว');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateAccountDto, userId: string) {
    const before = await this.findOne(id);
    const updated = await this.prisma.account.update({
      where: { id },
      data: dto,
    });
    await this.audit.log({
      userId,
      action: 'UPDATE',
      entityType: 'Account',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async exportExcel() {
    const accounts = await this.prisma.account.findMany({
      include: { parent: true },
      orderBy: { code: 'asc' },
    });
    return buildExcelBuffer(
      'Chart of Accounts',
      [
        { header: 'รหัสบัญชี', value: (r: (typeof accounts)[number]) => r.code },
        { header: 'ชื่อบัญชี', value: (r: (typeof accounts)[number]) => r.name },
        { header: 'ประเภท', value: (r: (typeof accounts)[number]) => r.type },
        { header: 'บัญชีแม่', value: (r: (typeof accounts)[number]) => r.parent?.name ?? '' },
        { header: 'สถานะ', value: (r: (typeof accounts)[number]) => (r.isActive ? 'ใช้งาน' : 'ปิดใช้งาน') },
      ],
      accounts,
    );
  }
}
