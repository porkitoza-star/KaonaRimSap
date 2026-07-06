import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateWhtCertificateDto } from './dto/create-wht-certificate.dto';

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

@Injectable()
export class WhtCertificatesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.whtCertificate.findMany({
      include: { bill: { include: { contact: true } }, payment: true },
      orderBy: { issueDate: 'desc' },
    });
  }

  async findOne(id: string) {
    const cert = await this.prisma.whtCertificate.findUnique({
      where: { id },
      include: { bill: { include: { contact: true } }, payment: true },
    });
    if (!cert) {
      throw new NotFoundException('ไม่พบใบหัก ณ ที่จ่ายนี้');
    }
    return cert;
  }

  private async generateCertNumber(issueDate: Date) {
    const buddhistYear = issueDate.getFullYear() + 543;
    const prefix = `WHT-${buddhistYear}-`;
    const count = await this.prisma.whtCertificate.count({
      where: { certNumber: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  async create(dto: CreateWhtCertificateDto, userId: string) {
    const bill = await this.prisma.bill.findUnique({ where: { id: dto.billId } });
    if (!bill) {
      throw new NotFoundException('ไม่พบบิลนี้');
    }

    const issueDate = new Date(dto.issueDate);
    const whtAmount = Math.round(dto.baseAmount * (dto.whtRate / 100) * 100) / 100;
    const certNumber = await this.generateCertNumber(issueDate);

    const created = await this.prisma.whtCertificate.create({
      data: {
        certType: dto.certType,
        certNumber,
        billId: dto.billId,
        paymentId: dto.paymentId,
        incomeTypeCode: dto.incomeTypeCode,
        baseAmount: dto.baseAmount,
        whtRate: dto.whtRate,
        whtAmount,
        issueDate,
      },
    });

    await this.audit.log({
      userId,
      action: 'CREATE',
      entityType: 'WhtCertificate',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  async exportCsv(year?: number): Promise<string> {
    const certs = await this.prisma.whtCertificate.findMany({
      where: year
        ? { issueDate: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } }
        : undefined,
      include: { bill: { include: { contact: true } } },
      orderBy: { issueDate: 'asc' },
    });

    const header = [
      'เลขที่ใบหัก ณ ที่จ่าย',
      'ประเภทแบบ',
      'ประเภทเงินได้',
      'ชื่อผู้ถูกหัก',
      'เลขผู้เสียภาษี',
      'วันที่ออกเอกสาร',
      'ยอดเงินได้',
      'อัตราภาษี (%)',
      'ภาษีหัก ณ ที่จ่าย',
    ];
    const rows = certs.map((c) => [
      c.certNumber,
      c.certType,
      c.incomeTypeCode,
      c.bill?.contact.name ?? '',
      c.bill?.contact.taxId ?? '',
      c.issueDate.toISOString().slice(0, 10),
      c.baseAmount.toString(),
      c.whtRate.toString(),
      c.whtAmount.toString(),
    ]);

    return [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');
  }
}
