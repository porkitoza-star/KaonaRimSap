import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { MarketComparable, MarketPositioning } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpsertMarketComparableDto } from './dto/upsert-market-comparable.dto';
import { GenerateInsightsDto } from './dto/generate-insights.dto';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function comparablePricePerSqm(c: MarketComparable): number | null {
  const area = c.usableAreaSqm !== null ? Number(c.usableAreaSqm) : null;
  if (!area || area <= 0) return null;
  const avgPrice = (Number(c.priceMin) + Number(c.priceMax)) / 2;
  return avgPrice / area;
}

function monthsSince(date: Date): number {
  const months = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  return Math.max(months, 1 / 30.44);
}

export interface MarketMetrics {
  competitorCount: number;
  avgPricePerSqm: number | null;
  minPricePerSqm: number | null;
  maxPricePerSqm: number | null;
  priceSpreadPercent: number | null;
  avgMonthlyAbsorptionPercent: number | null;
}

@Injectable()
export class MarketAnalysisService {
  private readonly logger = new Logger(MarketAnalysisService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    this.model = this.config.get<string>('CLAUDE_OCR_MODEL', 'claude-sonnet-5');
  }

  async findComparables(costCenterId: string) {
    return this.prisma.marketComparable.findMany({
      where: { costCenterId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createComparable(dto: UpsertMarketComparableDto, userId: string) {
    await this.prisma.costCenter.findUniqueOrThrow({ where: { id: dto.costCenterId } });
    const created = await this.prisma.marketComparable.create({
      data: {
        costCenterId: dto.costCenterId,
        projectName: dto.projectName,
        developerName: dto.developerName,
        location: dto.location,
        distanceKm: dto.distanceKm,
        houseType: dto.houseType,
        usableAreaSqm: dto.usableAreaSqm,
        priceMin: dto.priceMin,
        priceMax: dto.priceMax,
        unitsTotal: dto.unitsTotal,
        unitsSold: dto.unitsSold,
        launchDate: dto.launchDate ? new Date(dto.launchDate) : undefined,
        promotion: dto.promotion,
        notes: dto.notes,
      },
    });
    await this.audit.log({
      userId,
      action: 'CREATE',
      entityType: 'MarketComparable',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  async updateComparable(id: string, dto: UpsertMarketComparableDto, userId: string) {
    const before = await this.prisma.marketComparable.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException('ไม่พบข้อมูลคู่แข่งนี้');
    }
    const updated = await this.prisma.marketComparable.update({
      where: { id },
      data: {
        projectName: dto.projectName,
        developerName: dto.developerName,
        location: dto.location,
        distanceKm: dto.distanceKm,
        houseType: dto.houseType,
        usableAreaSqm: dto.usableAreaSqm,
        priceMin: dto.priceMin,
        priceMax: dto.priceMax,
        unitsTotal: dto.unitsTotal,
        unitsSold: dto.unitsSold,
        launchDate: dto.launchDate ? new Date(dto.launchDate) : null,
        promotion: dto.promotion,
        notes: dto.notes,
      },
    });
    await this.audit.log({
      userId,
      action: 'UPDATE',
      entityType: 'MarketComparable',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async removeComparable(id: string, userId: string) {
    const before = await this.prisma.marketComparable.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException('ไม่พบข้อมูลคู่แข่งนี้');
    }
    await this.prisma.marketComparable.delete({ where: { id } });
    await this.audit.log({
      userId,
      action: 'DELETE',
      entityType: 'MarketComparable',
      entityId: id,
      before,
    });
    return { success: true };
  }

  computeMetrics(comparables: MarketComparable[]): MarketMetrics {
    const pricesPerSqm = comparables
      .map(comparablePricePerSqm)
      .filter((p): p is number => p !== null && p > 0);

    const avgPricePerSqm = pricesPerSqm.length > 0 ? round2(pricesPerSqm.reduce((s, p) => s + p, 0) / pricesPerSqm.length) : null;
    const minPricePerSqm = pricesPerSqm.length > 0 ? round2(Math.min(...pricesPerSqm)) : null;
    const maxPricePerSqm = pricesPerSqm.length > 0 ? round2(Math.max(...pricesPerSqm)) : null;
    const priceSpreadPercent =
      avgPricePerSqm && minPricePerSqm !== null && maxPricePerSqm !== null && avgPricePerSqm > 0
        ? round2(((maxPricePerSqm - minPricePerSqm) / avgPricePerSqm) * 100)
        : null;

    const absorptionRates = comparables
      .filter((c) => c.unitsTotal && c.unitsTotal > 0 && c.unitsSold !== null && c.launchDate)
      .map((c) => {
        const soldRatio = Number(c.unitsSold) / Number(c.unitsTotal);
        const months = monthsSince(c.launchDate!);
        return (soldRatio / months) * 100;
      });
    const avgMonthlyAbsorptionPercent =
      absorptionRates.length > 0 ? round2(absorptionRates.reduce((s, r) => s + r, 0) / absorptionRates.length) : null;

    return {
      competitorCount: comparables.length,
      avgPricePerSqm,
      minPricePerSqm,
      maxPricePerSqm,
      priceSpreadPercent,
      avgMonthlyAbsorptionPercent,
    };
  }

  async getReport(costCenterId: string) {
    return this.prisma.marketAnalysisReport.findUnique({ where: { costCenterId } });
  }

  async generateInsights(costCenterId: string, dto: GenerateInsightsDto, userId: string) {
    if (!this.client) {
      throw new BadRequestException('ANTHROPIC_API_KEY ยังไม่ได้ตั้งค่า');
    }
    const costCenter = await this.prisma.costCenter.findUniqueOrThrow({ where: { id: costCenterId } });
    const comparables = await this.findComparables(costCenterId);
    if (comparables.length === 0) {
      throw new BadRequestException('ต้องเพิ่มข้อมูลโครงการคู่แข่งอย่างน้อย 1 รายการก่อนวิเคราะห์ตลาด');
    }
    const metrics = this.computeMetrics(comparables);

    const comparableLines = comparables
      .map((c, i) => {
        const priceSqm = comparablePricePerSqm(c);
        const absorption =
          c.unitsTotal && c.unitsSold !== null && c.launchDate
            ? `${round2((Number(c.unitsSold) / Number(c.unitsTotal)) * 100)}% (${c.unitsSold}/${c.unitsTotal} ยูนิต)`
            : 'ไม่ระบุ';
        return (
          `${i + 1}. "${c.projectName}"${c.developerName ? ` โดย ${c.developerName}` : ''} ` +
          `ที่ ${c.location}${c.distanceKm ? ` (ห่าง ${c.distanceKm} กม.)` : ''} — ` +
          `ประเภท: ${c.houseType ?? 'ไม่ระบุ'}, ราคา ${Number(c.priceMin).toLocaleString()}-${Number(c.priceMax).toLocaleString()} บาท` +
          `${priceSqm ? ` (~${round2(priceSqm).toLocaleString()} บาท/ตร.ม.)` : ''}, ` +
          `ขายไปแล้ว ${absorption}, โปรโมชั่น: ${c.promotion ?? 'ไม่ระบุ'}` +
          `${c.notes ? `, หมายเหตุ: ${c.notes}` : ''}`
        );
      })
      .join('\n');

    const ownLines = [
      `โครงการของเรา: "${costCenter.name}"`,
      dto.ownPricePerSqm ? `ราคาของเรา: ~${dto.ownPricePerSqm.toLocaleString()} บาท/ตร.ม.` : null,
      dto.ownPromotion ? `โปรโมชั่นของเรา: ${dto.ownPromotion}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const metricsLines = [
      `จำนวนคู่แข่งในพื้นที่: ${metrics.competitorCount} โครงการ`,
      metrics.avgPricePerSqm ? `ราคาเฉลี่ยคู่แข่ง: ${metrics.avgPricePerSqm.toLocaleString()} บาท/ตร.ม. (ช่วง ${metrics.minPricePerSqm?.toLocaleString()}-${metrics.maxPricePerSqm?.toLocaleString()})` : null,
      metrics.priceSpreadPercent !== null ? `ส่วนกระจายราคา: ${metrics.priceSpreadPercent}% ของราคาเฉลี่ย` : null,
      metrics.avgMonthlyAbsorptionPercent !== null ? `อัตราการขายเฉลี่ย: ${metrics.avgMonthlyAbsorptionPercent}% ต่อเดือน` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'คุณเป็นที่ปรึกษาด้านการตลาดอสังหาริมทรัพย์มืออาชีพ วิเคราะห์ทำเลและตำแหน่งทางการตลาด (Red Ocean vs Blue Ocean) ' +
                'ของโครงการจากข้อมูลต่อไปนี้ แล้วตอบกลับเป็น JSON เท่านั้น (ห้ามมีข้อความอื่นนอกเหนือจาก JSON):\n\n' +
                `${ownLines}\n\n` +
                `ข้อมูลคู่แข่งในพื้นที่:\n${comparableLines}\n\n` +
                `สรุปตัวเลข:\n${metricsLines}\n\n` +
                'ตอบกลับด้วย JSON keys ต่อไปนี้: ' +
                'positioning ("RED_OCEAN" หากตลาดมีคู่แข่งเยอะ ราคาใกล้เคียงกันแข่งขันดุเดือด หรือ "BLUE_OCEAN" หากมีคู่แข่งน้อยหรือมีจุดต่างที่ชัดเจน), ' +
                'positioningScore (ตัวเลข 0-100 ยิ่งสูงยิ่งเป็น Blue Ocean/แตกต่างจากตลาด), ' +
                'summary (สรุปวิเคราะห์ทำเล ราคา โปรโมชั่น อัตราการขาย เป็นภาษาไทย 3-5 ประโยค), ' +
                'recommendations (ข้อเสนอแนะเชิงกลยุทธ์ 3-5 ข้อ เป็นภาษาไทย แต่ละข้อขึ้นบรรทัดใหม่นำหน้าด้วย "- ")',
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );
    if (!textBlock) {
      throw new BadRequestException('ไม่ได้รับข้อความตอบกลับจาก Claude');
    }
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      this.logger.warn(`Market analysis response did not contain JSON: ${textBlock.text}`);
      throw new BadRequestException('ไม่พบ JSON ในคำตอบของ Claude');
    }
    const parsed = JSON.parse(jsonMatch[0]) as {
      positioning?: string;
      positioningScore?: number;
      summary?: string;
      recommendations?: string;
    };
    const positioning =
      parsed.positioning === 'RED_OCEAN' || parsed.positioning === 'BLUE_OCEAN'
        ? (parsed.positioning as MarketPositioning)
        : null;

    const before = await this.prisma.marketAnalysisReport.findUnique({ where: { costCenterId } });
    const saved = await this.prisma.marketAnalysisReport.upsert({
      where: { costCenterId },
      update: {
        ownPricePerSqm: dto.ownPricePerSqm,
        ownPromotion: dto.ownPromotion,
        positioning,
        positioningScore: parsed.positioningScore,
        summary: parsed.summary,
        recommendations: parsed.recommendations,
        generatedAt: new Date(),
      },
      create: {
        costCenterId,
        ownPricePerSqm: dto.ownPricePerSqm,
        ownPromotion: dto.ownPromotion,
        positioning,
        positioningScore: parsed.positioningScore,
        summary: parsed.summary,
        recommendations: parsed.recommendations,
        generatedAt: new Date(),
      },
    });

    await this.audit.log({
      userId,
      action: before ? 'UPDATE' : 'CREATE',
      entityType: 'MarketAnalysisReport',
      entityId: saved.id,
      before,
      after: saved,
    });

    return { report: saved, metrics };
  }
}
