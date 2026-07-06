import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ContactsService } from '../contacts/contacts.service';
import { BillsService } from '../bills/bills.service';
import { LocalStorageService } from './storage/local-storage.service';
import { ClaudeOcrService } from './ocr/claude-ocr.service';
import { ConfirmDocumentDto } from './dto/confirm-document.dto';

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
  ) {}

  async upload(file: Express.Multer.File, userId: string) {
    const fileUrl = await this.storage.save(file.buffer, file.originalname);

    let ocrRawJson: object | undefined;
    try {
      ocrRawJson = (await this.ocr.extractBillData(file.buffer, file.mimetype)) as unknown as object;
    } catch (err) {
      this.logger.warn(`OCR extraction failed, leaving document for manual entry: ${err}`);
    }

    const document = await this.prisma.document.create({
      data: {
        fileUrl,
        fileType: file.mimetype,
        ocrRawJson,
        uploadedById: userId,
        status: DocumentStatus.PENDING_REVIEW,
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

  findAll(status?: DocumentStatus) {
    return this.prisma.document.findMany({
      where: status ? { status } : undefined,
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
}
