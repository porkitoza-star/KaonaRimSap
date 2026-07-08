import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpsertFeasibilityDto } from './dto/upsert-feasibility.dto';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function withCalculations(record: {
  houseCount: number;
  constructionCostPerUnit: number;
  landCostPerUnit: number;
  otherCostPerUnit: number;
  sellingPricePerUnit: number;
}) {
  const costPerUnit = round2(
    Number(record.constructionCostPerUnit) +
      Number(record.landCostPerUnit) +
      Number(record.otherCostPerUnit),
  );
  const sellingPricePerUnit = Number(record.sellingPricePerUnit);
  const profitPerUnit = round2(sellingPricePerUnit - costPerUnit);
  const marginPercent = sellingPricePerUnit > 0 ? round2((profitPerUnit / sellingPricePerUnit) * 100) : 0;
  const totalCost = round2(costPerUnit * record.houseCount);
  const totalRevenue = round2(sellingPricePerUnit * record.houseCount);
  const totalProfit = round2(profitPerUnit * record.houseCount);

  return {
    ...record,
    costPerUnit,
    profitPerUnit,
    marginPercent,
    totalCost,
    totalRevenue,
    totalProfit,
  };
}

@Injectable()
export class FeasibilityService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findByCostCenter(costCenterId: string) {
    const record = await this.prisma.projectFeasibility.findUnique({ where: { costCenterId } });
    if (!record) {
      return null;
    }
    return withCalculations({
      houseCount: record.houseCount,
      constructionCostPerUnit: Number(record.constructionCostPerUnit),
      landCostPerUnit: Number(record.landCostPerUnit),
      otherCostPerUnit: Number(record.otherCostPerUnit),
      sellingPricePerUnit: Number(record.sellingPricePerUnit),
    });
  }

  async upsert(costCenterId: string, dto: UpsertFeasibilityDto, userId: string) {
    const before = await this.prisma.projectFeasibility.findUnique({ where: { costCenterId } });
    const saved = await this.prisma.projectFeasibility.upsert({
      where: { costCenterId },
      update: { ...dto },
      create: { costCenterId, ...dto },
    });

    await this.audit.log({
      userId,
      action: before ? 'UPDATE' : 'CREATE',
      entityType: 'ProjectFeasibility',
      entityId: saved.id,
      before,
      after: saved,
    });

    return withCalculations({
      houseCount: saved.houseCount,
      constructionCostPerUnit: Number(saved.constructionCostPerUnit),
      landCostPerUnit: Number(saved.landCostPerUnit),
      otherCostPerUnit: Number(saved.otherCostPerUnit),
      sellingPricePerUnit: Number(saved.sellingPricePerUnit),
    });
  }
}
