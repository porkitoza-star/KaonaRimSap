import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';

@Injectable()
export class CostCentersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.costCenter.findMany({
      orderBy: { name: 'asc' },
      include: { children: true },
    });
  }

  async findOne(id: string) {
    const costCenter = await this.prisma.costCenter.findUnique({
      where: { id },
      include: { children: true, parent: true },
    });
    if (!costCenter) {
      throw new NotFoundException('ไม่พบ cost center นี้');
    }
    return costCenter;
  }

  async create(dto: CreateCostCenterDto, userId: string) {
    const created = await this.prisma.costCenter.create({ data: dto });
    await this.audit.log({
      userId,
      action: 'CREATE',
      entityType: 'CostCenter',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  async update(id: string, dto: UpdateCostCenterDto, userId: string) {
    const before = await this.findOne(id);
    const updated = await this.prisma.costCenter.update({
      where: { id },
      data: dto,
    });
    await this.audit.log({
      userId,
      action: 'UPDATE',
      entityType: 'CostCenter',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }
}
