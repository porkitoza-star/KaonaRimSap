import { Injectable } from '@nestjs/common';
import { FeasibilityCostCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BoqTemplatesService } from '../boq-templates/boq-templates.service';
import { ConstructionPhasesService } from '../construction-phases/construction-phases.service';
import { FeasibilityService } from '../feasibility/feasibility.service';
import { PHASE_TEMPLATES } from '../construction-phases/phase-templates';
import {
  BASE_RATE_PER_SQM_BY_FLOORS,
  CATEGORY_LABELS,
  CATEGORY_PROPORTIONS,
  GRADE_MULTIPLIERS,
  PHASE_CATEGORY_WEIGHTS,
  ROOF_MULTIPLIERS,
  estimateDurationMonths,
} from './cost-rate-card';
import { EstimateScenarioDto } from './dto/estimate-scenario.dto';
import { ApplyScenarioDto } from './dto/apply-scenario.dto';

const SINGLE_STORY_TEMPLATE_ID = 'single-story-52sqm';
const SINGLE_STORY_TEMPLATE_BASE_AREA = 52;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class CostEstimatorService {
  constructor(
    private prisma: PrismaService,
    private boqTemplates: BoqTemplatesService,
    private constructionPhases: ConstructionPhasesService,
    private feasibility: FeasibilityService,
  ) {}

  computeScenario(dto: EstimateScenarioDto) {
    const houseCount = dto.houseCount ?? 1;
    const sellingPricePerUnit = dto.sellingPricePerUnit ?? 0;
    const landCost = dto.landCost ?? 0;
    const infrastructureCost = dto.infrastructureCost ?? 0;
    const overheadCost = dto.overheadCost ?? 0;
    const financingCost = dto.financingCost ?? 0;
    const taxRate = dto.corporateTaxRatePercent ?? 0;

    const baseRatePerSqm = BASE_RATE_PER_SQM_BY_FLOORS[dto.floors];
    const gradeMultiplier = GRADE_MULTIPLIERS[dto.grade];
    const roofMultiplier = ROOF_MULTIPLIERS[dto.roofType];
    const ratePerSqm = round2(baseRatePerSqm * gradeMultiplier * roofMultiplier);
    const constructionCostPerUnit = round2(dto.areaSqm * ratePerSqm);

    const categoryBreakdown = (Object.keys(CATEGORY_PROPORTIONS) as (keyof typeof CATEGORY_PROPORTIONS)[]).map(
      (key) => ({
        category: CATEGORY_LABELS[key],
        amount: round2(constructionCostPerUnit * CATEGORY_PROPORTIONS[key]),
      }),
    );

    const houseType = dto.floors === 1 ? 'SINGLE_STORY' : 'TWO_STORY';
    const template = PHASE_TEMPLATES[houseType];
    const countByCategory = new Map<string, number>();
    for (const p of template) {
      countByCategory.set(p.category, (countByCategory.get(p.category) ?? 0) + 1);
    }
    const phases = template.map((p) => {
      const weight = PHASE_CATEGORY_WEIGHTS[p.category] ?? 0;
      const count = countByCategory.get(p.category) ?? 1;
      return {
        sequence: p.sequence,
        category: p.category,
        name: p.name,
        estimatedValue: round2((constructionCostPerUnit * weight) / count),
      };
    });

    const totalConstructionCost = round2(constructionCostPerUnit * houseCount);
    const directCost = round2(landCost + totalConstructionCost + infrastructureCost);
    const totalCost = round2(directCost + overheadCost + financingCost);
    const totalRevenue = round2(sellingPricePerUnit * houseCount);
    const grossProfit = round2(totalRevenue - directCost);
    const operatingProfit = round2(grossProfit - overheadCost);
    const ebt = round2(operatingProfit - financingCost);
    const netProfit = round2(ebt * (1 - taxRate / 100));

    const fixedCost = round2(landCost + infrastructureCost + overheadCost + financingCost);
    const variableCostPerUnit = constructionCostPerUnit;
    const contributionMarginPerUnit = round2(sellingPricePerUnit - variableCostPerUnit);
    const breakEvenUnits =
      contributionMarginPerUnit > 0 ? round2(fixedCost / contributionMarginPerUnit) : null;
    const grossMarginPercent = totalRevenue > 0 ? round2((grossProfit / totalRevenue) * 100) : 0;

    return {
      inputs: {
        areaSqm: dto.areaSqm,
        floors: dto.floors,
        grade: dto.grade,
        roofType: dto.roofType,
        houseCount,
        sellingPricePerUnit,
      },
      rateCard: { baseRatePerSqm, gradeMultiplier, roofMultiplier, ratePerSqm },
      boq: { constructionCostPerUnit, categoryBreakdown, totalConstructionCost },
      timeline: { estimatedDurationMonths: estimateDurationMonths(dto.areaSqm, dto.floors), phases },
      feasibility: {
        totalRevenue,
        directCost,
        totalCost,
        grossProfit,
        operatingProfit,
        ebt,
        netProfit,
        fixedCost,
        variableCostPerUnit,
        contributionMarginPerUnit,
        breakEvenUnits,
        grossMarginPercent,
      },
    };
  }

  async applyScenario(dto: ApplyScenarioDto, userId: string) {
    await this.prisma.costCenter.findUniqueOrThrow({ where: { id: dto.costCenterId } });
    const scenario = this.computeScenario(dto);

    const effectiveAreaSqm = round2(
      dto.areaSqm * scenario.rateCard.gradeMultiplier * scenario.rateCard.roofMultiplier,
    );
    const boqResult = await this.boqTemplates.apply(
      SINGLE_STORY_TEMPLATE_ID,
      dto.costCenterId,
      effectiveAreaSqm,
      userId,
    );

    const existingPhaseCount = await this.prisma.constructionPhase.count({
      where: { costCenterId: dto.costCenterId },
    });
    let phasesCreated = 0;
    if (existingPhaseCount === 0) {
      for (const phase of scenario.timeline.phases) {
        await this.constructionPhases.create(
          {
            costCenterId: dto.costCenterId,
            sequence: phase.sequence,
            category: phase.category,
            name: phase.name,
            contractValue: phase.estimatedValue,
          },
          userId,
        );
        phasesCreated++;
      }
    }

    const costItems: { category: FeasibilityCostCategory; name: string; amount: number }[] = [
      {
        category: FeasibilityCostCategory.CONSTRUCTION,
        name: `ค่าก่อสร้าง (จากสถานการณ์ประมาณราคา ${dto.areaSqm} ตร.ม. x ${scenario.inputs.houseCount} หลัง)`,
        amount: scenario.boq.totalConstructionCost,
      },
    ];
    if ((dto.landCost ?? 0) > 0) {
      costItems.push({ category: FeasibilityCostCategory.LAND, name: 'ค่าที่ดิน', amount: dto.landCost! });
    }
    if ((dto.infrastructureCost ?? 0) > 0) {
      costItems.push({
        category: FeasibilityCostCategory.INFRASTRUCTURE,
        name: 'ค่าสาธารณูปโภคส่วนกลาง',
        amount: dto.infrastructureCost!,
      });
    }
    if ((dto.overheadCost ?? 0) > 0) {
      costItems.push({ category: FeasibilityCostCategory.OVERHEAD, name: 'ค่าใช้จ่ายดำเนินการ', amount: dto.overheadCost! });
    }
    if ((dto.financingCost ?? 0) > 0) {
      costItems.push({ category: FeasibilityCostCategory.FINANCING, name: 'ค่าใช้จ่ายทางการเงิน', amount: dto.financingCost! });
    }

    const feasibilityResult = await this.feasibility.upsert(
      dto.costCenterId,
      {
        houseCount: scenario.inputs.houseCount,
        sellingPricePerUnit: scenario.inputs.sellingPricePerUnit,
        corporateTaxRatePercent: dto.corporateTaxRatePercent ?? 0,
        costItems,
      },
      userId,
    );

    return {
      scenario,
      boq: boqResult,
      phasesCreated,
      phasesSkipped: existingPhaseCount > 0,
      feasibility: feasibilityResult,
    };
  }
}
