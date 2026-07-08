import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FeasibilityCostCategory, Prisma, StockTransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { buildExcelBuffer } from '../common/excel-export.util';
import { CreateMaterialItemDto } from './dto/create-material-item.dto';
import { UpdateMaterialItemDto } from './dto/update-material-item.dto';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';

function signedQuantity(type: StockTransactionType, quantity: number): number {
  if (type === StockTransactionType.USE) return -Math.abs(quantity);
  return quantity;
}

function currentStock(transactions: { type: StockTransactionType; quantity: Prisma.Decimal | number }[]): number {
  return transactions.reduce((sum, t) => sum + signedQuantity(t.type, Number(t.quantity)), 0);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function totalValue(item: {
  plannedQuantity: Prisma.Decimal | number;
  materialUnitPrice: Prisma.Decimal | number;
  laborUnitPrice: Prisma.Decimal | number;
}): number {
  return round2(Number(item.plannedQuantity) * (Number(item.materialUnitPrice) + Number(item.laborUnitPrice)));
}

@Injectable()
export class MaterialsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(costCenterId?: string) {
    const items = await this.prisma.materialItem.findMany({
      where: costCenterId ? { costCenterId } : undefined,
      include: { costCenter: true, transactions: true },
      orderBy: [{ costCenterId: 'asc' }, { category: 'asc' }, { name: 'asc' }],
    });
    return items.map((item) => ({
      ...item,
      currentStock: currentStock(item.transactions),
      totalValue: totalValue(item),
    }));
  }

  async getBoqValueForProject(projectCostCenterId: string) {
    const project = await this.prisma.costCenter.findUnique({
      where: { id: projectCostCenterId },
      include: { children: true },
    });
    if (!project) {
      throw new NotFoundException('ไม่พบ Cost Center นี้');
    }

    const houseIds = project.children.map((c) => c.id);
    const items =
      houseIds.length > 0
        ? await this.prisma.materialItem.findMany({ where: { costCenterId: { in: houseIds } } })
        : [];

    const byCategory: Record<FeasibilityCostCategory, number> = {
      LAND: 0,
      CONSTRUCTION: 0,
      INFRASTRUCTURE: 0,
      OVERHEAD: 0,
      FINANCING: 0,
    };
    for (const item of items) {
      byCategory[item.feasibilityCategory] = round2(byCategory[item.feasibilityCategory] + totalValue(item));
    }

    return {
      byCategory,
      total: round2(Object.values(byCategory).reduce((sum, v) => sum + v, 0)),
    };
  }

  async findLowStock() {
    const items = await this.findAll();
    return items.filter((item) => item.currentStock <= Number(item.reorderThreshold));
  }

  async findOne(id: string) {
    const item = await this.prisma.materialItem.findUnique({
      where: { id },
      include: {
        costCenter: true,
        transactions: { include: { createdBy: true }, orderBy: { transactionDate: 'desc' } },
      },
    });
    if (!item) {
      throw new NotFoundException('ไม่พบรายการวัสดุนี้');
    }
    return { ...item, currentStock: currentStock(item.transactions), totalValue: totalValue(item) };
  }

  async create(dto: CreateMaterialItemDto, userId: string) {
    const created = await this.prisma.materialItem.create({
      data: {
        costCenterId: dto.costCenterId,
        category: dto.category,
        name: dto.name,
        unit: dto.unit,
        plannedQuantity: dto.plannedQuantity,
        reorderThreshold: dto.reorderThreshold ?? 0,
        materialUnitPrice: dto.materialUnitPrice ?? 0,
        laborUnitPrice: dto.laborUnitPrice ?? 0,
        feasibilityCategory: dto.feasibilityCategory ?? FeasibilityCostCategory.CONSTRUCTION,
        notes: dto.notes,
      },
    });
    await this.audit.log({
      userId,
      action: 'CREATE',
      entityType: 'MaterialItem',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  async update(id: string, dto: UpdateMaterialItemDto, userId: string) {
    const before = await this.prisma.materialItem.findUniqueOrThrow({ where: { id } });
    const updated = await this.prisma.materialItem.update({
      where: { id },
      data: dto,
    });
    await this.audit.log({
      userId,
      action: 'UPDATE',
      entityType: 'MaterialItem',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async addTransaction(materialItemId: string, dto: CreateStockTransactionDto, userId: string) {
    await this.prisma.materialItem.findUniqueOrThrow({ where: { id: materialItemId } });

    if (dto.type !== StockTransactionType.ADJUST && dto.quantity <= 0) {
      throw new BadRequestException('จำนวนต้องมากกว่า 0 สำหรับรับเข้า/เบิกใช้');
    }
    if (dto.type === StockTransactionType.ADJUST && dto.quantity === 0) {
      throw new BadRequestException('จำนวนปรับปรุงต้องไม่เท่ากับ 0');
    }

    if (dto.type === StockTransactionType.USE) {
      const item = await this.findOne(materialItemId);
      if (item.currentStock < dto.quantity) {
        throw new BadRequestException(
          `สต๊อกคงเหลือไม่พอ (คงเหลือ ${item.currentStock} ${item.unit})`,
        );
      }
    }

    const created = await this.prisma.stockTransaction.create({
      data: {
        materialItemId,
        type: dto.type,
        quantity: dto.quantity,
        transactionDate: new Date(dto.transactionDate),
        notes: dto.notes,
        createdById: userId,
      },
    });

    await this.audit.log({
      userId,
      action: 'STOCK_TRANSACTION',
      entityType: 'MaterialItem',
      entityId: materialItemId,
      after: created,
    });
    return created;
  }

  async exportExcel() {
    const items = await this.findAll();
    return buildExcelBuffer(
      'Materials',
      [
        { header: 'Cost Center', value: (r: (typeof items)[number]) => r.costCenter.name },
        { header: 'หมวดงาน', value: (r: (typeof items)[number]) => r.category },
        { header: 'วัสดุ', value: (r: (typeof items)[number]) => r.name },
        { header: 'หน่วย', value: (r: (typeof items)[number]) => r.unit },
        { header: 'ปริมาณตามแผน', value: (r: (typeof items)[number]) => Number(r.plannedQuantity) },
        { header: 'คงเหลือ', value: (r: (typeof items)[number]) => r.currentStock },
        { header: 'จุดสั่งซื้อเพิ่ม', value: (r: (typeof items)[number]) => Number(r.reorderThreshold) },
        { header: 'ราคาวัสดุ/หน่วย', value: (r: (typeof items)[number]) => Number(r.materialUnitPrice) },
        { header: 'ราคาค่าแรง/หน่วย', value: (r: (typeof items)[number]) => Number(r.laborUnitPrice) },
        { header: 'มูลค่ารวม', value: (r: (typeof items)[number]) => r.totalValue },
        { header: 'หมวด Feasibility', value: (r: (typeof items)[number]) => r.feasibilityCategory },
        {
          header: 'ควรสั่งเพิ่ม',
          value: (r: (typeof items)[number]) =>
            r.currentStock <= Number(r.reorderThreshold) ? 'ใช่' : '',
        },
      ],
      items,
    );
  }
}
