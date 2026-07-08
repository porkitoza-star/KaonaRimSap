import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { HouseTemplateType, PHASE_TEMPLATES } from './phase-templates';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseProgressDto } from './dto/update-phase-progress.dto';

function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

@Injectable()
export class ConstructionPhasesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAllForCostCenter(costCenterId: string) {
    const phases = await this.prisma.constructionPhase.findMany({
      where: { costCenterId },
      orderBy: { sequence: 'asc' },
    });

    const actualStarts = phases.map((p) => p.actualStartDate).filter((d): d is Date => d !== null);
    const actualEnds = phases.map((p) => p.actualEndDate).filter((d): d is Date => d !== null);
    const allComplete = phases.length > 0 && phases.every((p) => p.actualEndDate !== null);

    const overallPercent =
      phases.length === 0
        ? 0
        : Math.round(phases.reduce((sum, p) => sum + p.percentComplete, 0) / phases.length);

    const leadTimeDays =
      allComplete && actualStarts.length > 0
        ? daysBetween(
            new Date(Math.min(...actualStarts.map((d) => d.getTime()))),
            new Date(Math.max(...actualEnds.map((d) => d.getTime()))),
          )
        : null;

    const plannedStarts = phases.map((p) => p.plannedStartDate).filter((d): d is Date => d !== null);
    const plannedEnds = phases.map((p) => p.plannedEndDate).filter((d): d is Date => d !== null);
    const plannedLeadTimeDays =
      plannedStarts.length > 0 && plannedEnds.length > 0
        ? daysBetween(
            new Date(Math.min(...plannedStarts.map((d) => d.getTime()))),
            new Date(Math.max(...plannedEnds.map((d) => d.getTime()))),
          )
        : null;

    return {
      phases,
      summary: {
        overallPercent,
        allComplete,
        leadTimeDays,
        plannedLeadTimeDays,
      },
    };
  }

  async seedFromTemplate(costCenterId: string, houseType: HouseTemplateType, userId: string) {
    const existingCount = await this.prisma.constructionPhase.count({ where: { costCenterId } });
    if (existingCount > 0) {
      throw new BadRequestException(
        'Cost Center นี้มีขั้นตอนงานอยู่แล้ว ลบของเดิมก่อนถ้าต้องการเริ่มใหม่จากเทมเพลต',
      );
    }

    const template = PHASE_TEMPLATES[houseType];
    const created = await this.prisma.$transaction(
      template.map((item) =>
        this.prisma.constructionPhase.create({
          data: {
            costCenterId,
            sequence: item.sequence,
            category: item.category,
            name: item.name,
          },
        }),
      ),
    );

    await this.audit.log({
      userId,
      action: 'SEED_TEMPLATE',
      entityType: 'ConstructionPhase',
      entityId: costCenterId,
      after: { houseType, count: created.length },
    });
    return created;
  }

  async create(dto: CreatePhaseDto, userId: string) {
    const created = await this.prisma.constructionPhase.create({ data: dto });
    await this.audit.log({
      userId,
      action: 'CREATE',
      entityType: 'ConstructionPhase',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  async updateProgress(id: string, dto: UpdatePhaseProgressDto, userId: string) {
    const before = await this.prisma.constructionPhase.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException('ไม่พบขั้นตอนงานนี้');
    }
    const updated = await this.prisma.constructionPhase.update({
      where: { id },
      data: {
        plannedStartDate: dto.plannedStartDate ? new Date(dto.plannedStartDate) : undefined,
        plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : undefined,
        actualStartDate: dto.actualStartDate ? new Date(dto.actualStartDate) : undefined,
        actualEndDate: dto.actualEndDate ? new Date(dto.actualEndDate) : undefined,
        percentComplete: dto.percentComplete,
        notes: dto.notes,
      },
    });
    await this.audit.log({
      userId,
      action: 'UPDATE_PROGRESS',
      entityType: 'ConstructionPhase',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async remove(id: string, userId: string) {
    const before = await this.prisma.constructionPhase.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException('ไม่พบขั้นตอนงานนี้');
    }
    await this.prisma.constructionPhase.delete({ where: { id } });
    await this.audit.log({
      userId,
      action: 'DELETE',
      entityType: 'ConstructionPhase',
      entityId: id,
      before,
    });
    return { success: true };
  }
}
