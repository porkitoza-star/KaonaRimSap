import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BOQ_TEMPLATES, BoqTemplateItem } from './boq-template-data';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function categorySubtotals(items: { category: string; unitPrice: number; quantity: number }[]) {
  const totals = new Map<string, number>();
  for (const item of items) {
    const amount = item.unitPrice * item.quantity;
    totals.set(item.category, round2((totals.get(item.category) ?? 0) + amount));
  }
  return [...totals.entries()].map(([category, amount]) => ({ category, amount }));
}

function scaleItems(items: BoqTemplateItem[], ratio: number) {
  return items.map((item) => {
    const quantity = round2(item.quantity * ratio);
    return { ...item, quantity, amount: round2(quantity * item.unitPrice) };
  });
}

@Injectable()
export class BoqTemplatesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  findAll() {
    return BOQ_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      baseAreaSqm: t.baseAreaSqm,
      itemCount: t.items.length,
      categorySubtotals: categorySubtotals(t.items),
      totalAmount: round2(t.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)),
    }));
  }

  private getTemplateOrThrow(id: string) {
    const template = BOQ_TEMPLATES.find((t) => t.id === id);
    if (!template) {
      throw new NotFoundException('ไม่พบเทมเพลต BOQ นี้');
    }
    return template;
  }

  findOne(id: string) {
    const template = this.getTemplateOrThrow(id);
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      baseAreaSqm: template.baseAreaSqm,
      items: template.items,
      categorySubtotals: categorySubtotals(template.items),
      totalAmount: round2(template.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)),
    };
  }

  preview(id: string, targetAreaSqm: number) {
    const template = this.getTemplateOrThrow(id);
    const ratio = targetAreaSqm / template.baseAreaSqm;
    const scaledItems = scaleItems(template.items, ratio);
    return {
      templateId: template.id,
      baseAreaSqm: template.baseAreaSqm,
      targetAreaSqm,
      scaleRatio: round2(ratio),
      items: scaledItems,
      categorySubtotals: categorySubtotals(scaledItems),
      totalAmount: round2(scaledItems.reduce((sum, i) => sum + i.amount, 0)),
    };
  }

  async apply(id: string, costCenterId: string, targetAreaSqm: number, userId: string) {
    const template = this.getTemplateOrThrow(id);
    await this.prisma.costCenter.findUniqueOrThrow({ where: { id: costCenterId } });

    const ratio = targetAreaSqm / template.baseAreaSqm;
    const scaledItems = scaleItems(template.items, ratio);

    const created = await this.prisma.$transaction(
      scaledItems.map((item) =>
        this.prisma.materialItem.create({
          data: {
            costCenterId,
            category: item.category,
            name: item.name,
            unit: item.unit,
            plannedQuantity: item.quantity,
            reorderThreshold: 0,
            notes: item.notes
              ? `${item.notes} (สร้างจากเทมเพลต "${template.name}" ที่ ${targetAreaSqm} ตร.ม.)`
              : `สร้างจากเทมเพลต "${template.name}" ที่ ${targetAreaSqm} ตร.ม.`,
          },
        }),
      ),
    );

    await this.audit.log({
      userId,
      action: 'APPLY_BOQ_TEMPLATE',
      entityType: 'MaterialItem',
      entityId: costCenterId,
      after: { templateId: id, targetAreaSqm, itemCount: created.length },
    });

    return { createdCount: created.length, totalAmount: round2(scaledItems.reduce((sum, i) => sum + i.amount, 0)) };
  }
}
