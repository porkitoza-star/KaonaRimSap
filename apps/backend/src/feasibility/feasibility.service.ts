import { Injectable } from '@nestjs/common';
import { FeasibilityCostCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpsertFeasibilityDto } from './dto/upsert-feasibility.dto';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

type FeasibilityWithItems = Prisma.ProjectFeasibilityGetPayload<{ include: { costItems: true } }>;

function toResponse(record: FeasibilityWithItems) {
  const items = record.costItems.map((i) => ({
    id: i.id,
    category: i.category,
    name: i.name,
    amount: Number(i.amount),
    notes: i.notes,
  }));

  const sumBy = (category: FeasibilityCostCategory) =>
    items.filter((i) => i.category === category).reduce((sum, i) => sum + i.amount, 0);

  const totalLand = sumBy(FeasibilityCostCategory.LAND);
  const totalConstruction = sumBy(FeasibilityCostCategory.CONSTRUCTION);
  const totalInfrastructure = sumBy(FeasibilityCostCategory.INFRASTRUCTURE);
  const totalOverhead = sumBy(FeasibilityCostCategory.OVERHEAD);
  const totalFinancing = sumBy(FeasibilityCostCategory.FINANCING);

  const directCost = totalLand + totalConstruction + totalInfrastructure;
  const totalCost = directCost + totalOverhead + totalFinancing;
  const totalRevenue = round2(Number(record.sellingPricePerUnit) * record.houseCount);

  const grossProfit = round2(totalRevenue - directCost);
  const ebit = round2(grossProfit - totalOverhead);
  const ebt = round2(ebit - totalFinancing);
  const taxRate = Number(record.corporateTaxRatePercent);
  const netProfit = round2(ebt * (1 - taxRate / 100));

  const equityAmount = record.equityAmount !== null ? Number(record.equityAmount) : null;

  return {
    houseCount: record.houseCount,
    sellingPricePerUnit: Number(record.sellingPricePerUnit),
    equityAmount,
    corporateTaxRatePercent: taxRate,
    notes: record.notes,
    costItems: items,
    summary: {
      totalLand: round2(totalLand),
      totalConstruction: round2(totalConstruction),
      totalInfrastructure: round2(totalInfrastructure),
      totalOverhead: round2(totalOverhead),
      totalFinancing: round2(totalFinancing),
      totalCost: round2(totalCost),
      totalRevenue,
      grossProfit,
      ebit,
      ebt,
      netProfit,
      rosPercent: totalRevenue > 0 ? round2((netProfit / totalRevenue) * 100) : 0,
      roiPercent: totalCost > 0 ? round2((netProfit / totalCost) * 100) : 0,
      roePercent: equityAmount !== null && equityAmount > 0 ? round2((netProfit / equityAmount) * 100) : null,
      costPerUnit: record.houseCount > 0 ? round2(totalCost / record.houseCount) : 0,
      profitPerUnit: record.houseCount > 0 ? round2(netProfit / record.houseCount) : 0,
    },
  };
}

@Injectable()
export class FeasibilityService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findByCostCenter(costCenterId: string) {
    const record = await this.prisma.projectFeasibility.findUnique({
      where: { costCenterId },
      include: { costItems: true },
    });
    if (!record) {
      return null;
    }
    return toResponse(record);
  }

  async upsert(costCenterId: string, dto: UpsertFeasibilityDto, userId: string) {
    const before = await this.prisma.projectFeasibility.findUnique({
      where: { costCenterId },
      include: { costItems: true },
    });

    const saved = await this.prisma.$transaction(async (tx) => {
      const header = await tx.projectFeasibility.upsert({
        where: { costCenterId },
        update: {
          houseCount: dto.houseCount,
          sellingPricePerUnit: dto.sellingPricePerUnit,
          equityAmount: dto.equityAmount ?? null,
          corporateTaxRatePercent: dto.corporateTaxRatePercent ?? 0,
          notes: dto.notes,
        },
        create: {
          costCenterId,
          houseCount: dto.houseCount,
          sellingPricePerUnit: dto.sellingPricePerUnit,
          equityAmount: dto.equityAmount ?? null,
          corporateTaxRatePercent: dto.corporateTaxRatePercent ?? 0,
          notes: dto.notes,
        },
      });

      await tx.feasibilityCostItem.deleteMany({ where: { feasibilityId: header.id } });
      if (dto.costItems.length > 0) {
        await tx.feasibilityCostItem.createMany({
          data: dto.costItems.map((item) => ({
            feasibilityId: header.id,
            category: item.category,
            name: item.name,
            amount: item.amount,
            notes: item.notes,
          })),
        });
      }

      return tx.projectFeasibility.findUniqueOrThrow({
        where: { id: header.id },
        include: { costItems: true },
      });
    });

    await this.audit.log({
      userId,
      action: before ? 'UPDATE' : 'CREATE',
      entityType: 'ProjectFeasibility',
      entityId: saved.id,
      before,
      after: saved,
    });

    return toResponse(saved);
  }
}
