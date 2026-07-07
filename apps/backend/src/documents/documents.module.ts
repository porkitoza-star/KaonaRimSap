import { Module } from '@nestjs/common';
import { ContactsModule } from '../contacts/contacts.module';
import { BillsModule } from '../bills/bills.module';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { LocalStorageService } from './storage/local-storage.service';
import { ClaudeOcrService } from './ocr/claude-ocr.service';

@Module({
  imports: [ContactsModule, BillsModule],
  providers: [DocumentsService, LocalStorageService, ClaudeOcrService],
  controllers: [DocumentsController],
  exports: [DocumentsService],
})
export class DocumentsModule {}
