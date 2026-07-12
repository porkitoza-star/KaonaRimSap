import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DocumentCategory, DocumentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ContactsService } from '../contacts/contacts.service';
import { BillsService } from '../bills/bills.service';
import { MaterialsService } from '../materials/materials.service';
import { buildExcelBuffer } from '../common/excel-export.util';
import { LocalStorageService } from './storage/local-storage.service';
import { ClaudeOcrService } from './ocr/claude-ocr.service';
import { ConfirmDocumentDto } from './dto/confirm-document.dto';
import { ImportBoqItemsDto } from './dto/import-boq-items.dto';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private storage: LocalStorageService,
    private ocr: ClaudeOcrService,
    private contacts: ContactsService,
    private bills: BillsService,
    private materials: MaterialsService,
  ) {}

  async upload(file: Express.Multer.File, userId: string, category: DocumentCategory) {
    const fileUrl = await this.storage.save(file.buffer, file.originalname);

    // Other document categories (permits, POs, photos) are just filed as-is.
    let ocrRawJson: object | undefined;
    if (category === DocumentCategory.BILL && file.mimetype.startsWith('image/')) {
      try {
        ocrRawJson = (await this.ocr.extractBillData(file.buffer, file.mimetype)) as unknown as object;
      } catch (err) {
        this.logger.warn(`OCR extraction failed, leaving document for manual entry: ${err}`);
      }
    } else if (
      category === DocumentCategory.BOQ &&
      (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf')
    ) {
      try {
        ocrRawJson = (await this.ocr.extractBoqData(file.buffer, file.mimetype)) as unknown as object;
      } catch (err) {
        this.logger.warn(`BOQ extraction failed, leaving document as file-only: ${err}`);
      }
    }

    const isBill = category === DocumentCategory.BILL;
    const document = await this.prisma.document.create({
      data: {
        fileUrl,
        fileType: file.mimetype,
        category,
        ocrRawJson,
        uploadedById: userId,
        status: isBill ? DocumentStatus.PENDING_REVIEW : DocumentStatus.CONFIRMED,
        reviewedById: isBill ? undefined : userId,
        reviewedAt: isBill ? undefined : new Date(),
      },
    });

    await this.audit.log({
      userId,
      action: 'CREATE',
      entityType: 'Document',
      entityId: document.id,
      after: document,
    });
    return document;
  }

  findAll(status?: DocumentStatus, category?: DocumentCategory) {
    return this.prisma.document.findMany({
      where: { status, category },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) {
      throw new NotFoundException('ไม่พบเอกสารนี้');
    }
    return document;
  }

  async getFileBuffer(id: string) {
    const document = await this.findOne(id);
    return this.storage.read(document.fileUrl);
  }

  async confirm(id: string, dto: ConfirmDocumentDto, userId: string) {
    const document = await this.findOne(id);
    if (document.status !== DocumentStatus.PENDING_REVIEW) {
      throw new BadRequestException('ยืนยันได้เฉพาะเอกสารสถานะ PENDING_REVIEW เท่านั้น');
    }

    const contact = await this.contacts.findOrCreateSupplier(dto.contactName, dto.contactTaxId);

    const bill = await this.bills.create(
      {
        number: dto.documentNumber,
        contactId: contact.id,
        issueDate: dto.issueDate,
        dueDate: dto.dueDate,
        vatAmount: dto.vatAmount,
        whtAmount: dto.whtAmount,
        lines: [
          {
            description: dto.description ?? `${dto.contactName} - ${dto.documentNumber}`,
            amount: dto.subtotal,
            costCenterId: dto.costCenterId,
            accountId: dto.accountId,
            workCategory: dto.workCategory,
          },
        ],
      },
      userId,
    );
    const confirmedBill = await this.bills.confirm(bill.id, userId);

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        status: DocumentStatus.CONFIRMED,
        reviewedById: userId,
        reviewedAt: new Date(),
        billId: confirmedBill.id,
        costCenterId: dto.costCenterId,
        accountId: dto.accountId,
      },
    });

    await this.audit.log({
      userId,
      action: 'CONFIRM',
      entityType: 'Document',
      entityId: id,
      before: document,
      after: updated,
    });
    return updated;
  }

  async importBoqItems(id: string, dto: ImportBoqItemsDto, userId: string) {
    await this.findOne(id);
    const created = [];
    for (const item of dto.items) {
      const materialItem = await this.materials.create(
        {
          costCenterId: dto.costCenterId,
          category: item.category?.trim() || 'จากเอกสาร BOQ',
          name: item.name,
          unit: item.unit?.trim() || 'หน่วย',
          plannedQuantity: item.quantity ?? 0,
          notes: item.unitPrice ? `ราคาต่อหน่วย ~${item.unitPrice} บาท (จาก OCR เอกสาร)` : undefined,
        },
        userId,
      );
      created.push(materialItem);
    }

    await this.audit.log({
      userId,
      action: 'IMPORT_BOQ_ITEMS',
      entityType: 'Document',
      entityId: id,
      after: { costCenterId: dto.costCenterId, createdCount: created.length },
    });
    return { createdCount: created.length };
  }

  async reject(id: string, userId: string, notes: string | undefined) {
    const document = await this.findOne(id);
    if (document.status !== DocumentStatus.PENDING_REVIEW) {
      throw new BadRequestException('ปฏิเสธได้เฉพาะเอกสารสถานะ PENDING_REVIEW เท่านั้น');
    }
    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        status: DocumentStatus.REJECTED,
        reviewedById: userId,
        reviewedAt: new Date(),
        notes,
      },
    });
    await this.audit.log({
      userId,
      action: 'REJECT',
      entityType: 'Document',
      entityId: id,
      before: document,
      after: updated,
    });
    return updated;
  }

  async exportExcel() {
    const documents = await this.prisma.document.findMany({
      include: { uploadedBy: true },
      orderBy: { createdAt: 'desc' },
    });
    return buildExcelBuffer(
      'Documents',
      [
        { header: 'ประเภท', value: (r: (typeof documents)[number]) => r.category },
        { header: 'สถานะ', value: (r: (typeof documents)[number]) => r.status },
        { header: 'ผู้อัปโหลด', value: (r: (typeof documents)[number]) => r.uploadedBy.name },
        {
          header: 'วันที่อัปโหลด',
          value: (r: (typeof documents)[number]) => r.createdAt.toISOString().slice(0, 10),
        },
        { header: 'หมายเหตุ', value: (r: (typeof documents)[number]) => r.notes ?? '' },
      ],
      documents,
    );
  }
}
