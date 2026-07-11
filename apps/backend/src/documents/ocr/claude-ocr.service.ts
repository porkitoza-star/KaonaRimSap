import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface OcrBillData {
  documentNumber?: string;
  issueDate?: string;
  contactName?: string;
  taxId?: string;
  subtotal?: number;
  vatAmount?: number;
  totalAmount?: number;
}

export interface OcrBoqItem {
  category?: string;
  name: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
}

export interface OcrBoqData {
  items: OcrBoqItem[];
}

type SupportedMimeType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

const SUPPORTED_MIME_TYPES: SupportedMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

type BoqSupportedMimeType = SupportedMimeType | 'application/pdf';

const BOQ_SUPPORTED_MIME_TYPES: BoqSupportedMimeType[] = [...SUPPORTED_MIME_TYPES, 'application/pdf'];

@Injectable()
export class ClaudeOcrService {
  private readonly logger = new Logger(ClaudeOcrService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    this.model = this.config.get<string>('CLAUDE_OCR_MODEL', 'claude-sonnet-5');
  }

  async extractBillData(imageBuffer: Buffer, mimeType: string): Promise<OcrBillData> {
    if (!this.client) {
      throw new Error('ANTHROPIC_API_KEY ยังไม่ได้ตั้งค่า');
    }
    if (!SUPPORTED_MIME_TYPES.includes(mimeType as SupportedMimeType)) {
      throw new Error(`ไม่รองรับไฟล์ประเภท ${mimeType} สำหรับการอ่าน OCR`);
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as SupportedMimeType,
                data: imageBuffer.toString('base64'),
              },
            },
            {
              type: 'text',
              text:
                'อ่านข้อมูลจากรูปบิล/ใบกำกับภาษีนี้ แล้วตอบกลับเป็น JSON เท่านั้น (ห้ามมีข้อความอื่นนอกเหนือจาก JSON) ' +
                'ด้วย keys ต่อไปนี้: documentNumber (เลขที่เอกสาร), issueDate (รูปแบบ YYYY-MM-DD), ' +
                'contactName (ชื่อคู่ค้า/ผู้ออกเอกสาร), taxId (เลขประจำตัวผู้เสียภาษี 13 หลัก), ' +
                'subtotal (ยอดก่อน VAT เป็นตัวเลขล้วน ไม่มีเครื่องหมายจุลภาค), ' +
                'vatAmount (ภาษีมูลค่าเพิ่มเป็นตัวเลขล้วน), totalAmount (ยอดรวมสุทธิเป็นตัวเลขล้วน). ' +
                'หากอ่านค่าใดไม่ได้ให้ใส่ null สำหรับ key นั้น',
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );
    if (!textBlock) {
      throw new Error('ไม่ได้รับข้อความตอบกลับจาก Claude');
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      this.logger.warn(`Claude OCR response did not contain JSON: ${textBlock.text}`);
      throw new Error('ไม่พบ JSON ในคำตอบของ Claude');
    }

    return JSON.parse(jsonMatch[0]) as OcrBillData;
  }

  async extractBoqData(fileBuffer: Buffer, mimeType: string): Promise<OcrBoqData> {
    if (!this.client) {
      throw new Error('ANTHROPIC_API_KEY ยังไม่ได้ตั้งค่า');
    }
    if (!BOQ_SUPPORTED_MIME_TYPES.includes(mimeType as BoqSupportedMimeType)) {
      throw new Error(`ไม่รองรับไฟล์ประเภท ${mimeType} สำหรับการอ่าน BOQ`);
    }

    const isPdf = mimeType === 'application/pdf';
    const fileBlock: Anthropic.Beta.Messages.BetaContentBlockParam = isPdf
      ? {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: fileBuffer.toString('base64'),
          },
        }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType as SupportedMimeType,
            data: fileBuffer.toString('base64'),
          },
        };

    const response = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: 4096,
      betas: ['pdfs-2024-09-25'],
      messages: [
        {
          role: 'user',
          content: [
            fileBlock,
            {
              type: 'text',
              text:
                'อ่านรายการ BOQ (Bill of Quantities / รายการวัสดุและปริมาณงาน) จากเอกสารนี้ทุกหน้า ' +
                'แล้วตอบกลับเป็น JSON เท่านั้น (ห้ามมีข้อความอื่นนอกเหนือจาก JSON) ' +
                'ด้วย key เดียวคือ items ซึ่งเป็น array ของ object ต่อไปนี้: ' +
                'category (หมวดงาน เช่น งานฐานราก, งานโครงสร้าง), name (ชื่อรายการ), ' +
                'unit (หน่วยนับ), quantity (ปริมาณเป็นตัวเลขล้วน), ' +
                'unitPrice (ราคาต่อหน่วยเป็นตัวเลขล้วน), amount (ยอดรวมรายการเป็นตัวเลขล้วน). ' +
                'หากอ่านค่าใดไม่ได้ให้ใส่ null สำหรับ key นั้น อ่านให้ครบทุกรายการที่พบในเอกสาร',
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.Beta.Messages.BetaTextBlock => block.type === 'text',
    );
    if (!textBlock) {
      throw new Error('ไม่ได้รับข้อความตอบกลับจาก Claude');
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      this.logger.warn(`Claude BOQ OCR response did not contain JSON: ${textBlock.text}`);
      throw new Error('ไม่พบ JSON ในคำตอบของ Claude');
    }

    const parsed = JSON.parse(jsonMatch[0]) as { items?: unknown };
    return { items: Array.isArray(parsed.items) ? (parsed.items as OcrBoqItem[]) : [] };
  }
}
