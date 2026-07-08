import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePaymentMilestoneDto } from './dto/create-payment-milestone.dto';
import { UpdatePaymentMilestoneDto } from './dto/update-payment-milestone.dto';
import { GenerateMilestonesDto } from './dto/generate-milestones.dto';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class PaymentMilestonesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAllForCostCenter(costCenterId: string) {
    const milestones = await this.prisma.paymentMilestone.findMany({
      where: { costCenterId },
      orderBy: { sequence: 'asc' },
    });

    const totalAmount = milestones.reduce((sum, m) => sum + Number(m.amount), 0);
    const totalReceived = milestones
      .filter((m) => m.actualPaidDate !== null)
      .reduce((sum, m) => sum + Number(m.amount), 0);

    return {
      milestones,
      summary: {
        totalAmount,
        totalReceived,
        totalPending: Math.round((totalAmount - totalReceived) * 100) / 100,
      },
    };
  }

  async create(dto: CreatePaymentMilestoneDto, userId: string) {
    const created = await this.prisma.paymentMilestone.create({
      data: {
        costCenterId: dto.costCenterId,
        sequence: dto.sequence,
        name: dto.name,
        amount: dto.amount,
        plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : undefined,
        notes: dto.notes,
      },
    });
    await this.audit.log({
      userId,
      action: 'CREATE',
      entityType: 'PaymentMilestone',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  async generateFromPercentages(dto: GenerateMilestonesDto, userId: string) {
    const totalPercent = round2(dto.milestones.reduce((sum, m) => sum + m.percent, 0));
    if (Math.abs(totalPercent - 100) > 0.1) {
      throw new BadRequestException(`เปอร์เซ็นต์รวมต้องเท่ากับ 100% (ตอนนี้รวม ${totalPercent}%)`);
    }

    const existingCount = await this.prisma.paymentMilestone.count({
      where: { costCenterId: dto.costCenterId },
    });

    const created = await this.prisma.$transaction(
      dto.milestones.map((m, index) =>
        this.prisma.paymentMilestone.create({
          data: {
            costCenterId: dto.costCenterId,
            sequence: existingCount + index + 1,
            name: m.name,
            amount: round2((dto.totalContractValue * m.percent) / 100),
            plannedDate: m.plannedDate ? new Date(m.plannedDate) : undefined,
          },
        }),
      ),
    );

    await this.audit.log({
      userId,
      action: 'GENERATE_FROM_PERCENTAGES',
      entityType: 'PaymentMilestone',
      entityId: dto.costCenterId,
      after: { count: created.length, totalContractValue: dto.totalContractValue },
    });

    return created;
  }

  async update(id: string, dto: UpdatePaymentMilestoneDto, userId: string) {
    const before = await this.prisma.paymentMilestone.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException('ไม่พบงวดเงินนี้');
    }
    const updated = await this.prisma.paymentMilestone.update({
      where: { id },
      data: {
        name: dto.name,
        amount: dto.amount,
        plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : undefined,
        actualPaidDate: dto.actualPaidDate ? new Date(dto.actualPaidDate) : undefined,
        notes: dto.notes,
      },
    });
    await this.audit.log({
      userId,
      action: 'UPDATE',
      entityType: 'PaymentMilestone',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async remove(id: string, userId: string) {
    const before = await this.prisma.paymentMilestone.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException('ไม่พบงวดเงินนี้');
    }
    await this.prisma.paymentMilestone.delete({ where: { id } });
    await this.audit.log({
      userId,
      action: 'DELETE',
      entityType: 'PaymentMilestone',
      entityId: id,
      before,
    });
    return { success: true };
  }
}
