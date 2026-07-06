import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.contact.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id } });
    if (!contact) {
      throw new NotFoundException('ไม่พบคู่ค้ารายนี้');
    }
    return contact;
  }

  async create(dto: CreateContactDto, userId: string) {
    const created = await this.prisma.contact.create({ data: dto });
    await this.audit.log({
      userId,
      action: 'CREATE',
      entityType: 'Contact',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  async update(id: string, dto: UpdateContactDto, userId: string) {
    const before = await this.findOne(id);
    const updated = await this.prisma.contact.update({ where: { id }, data: dto });
    await this.audit.log({
      userId,
      action: 'UPDATE',
      entityType: 'Contact',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }
}
