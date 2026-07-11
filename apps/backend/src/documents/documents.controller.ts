import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DocumentCategory, DocumentStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import { ConfirmDocumentDto } from './dto/confirm-document.dto';
import { RejectDocumentDto } from './dto/reject-document.dto';
import { ImportBoqItemsDto } from './dto/import-boq-items.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Get()
  findAll(
    @Query('status') status?: DocumentStatus,
    @Query('category') category?: DocumentCategory,
  ) {
    return this.documentsService.findAll(status, category);
  }

  @Get('export')
  async export(@Res() res: Response) {
    const buffer = await this.documentsService.exportExcel();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="documents.xlsx"');
    res.send(buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Get(':id/file')
  async getFile(@Param('id') id: string, @Res() res: Response) {
    const document = await this.documentsService.findOne(id);
    const buffer = await this.documentsService.getFileBuffer(id);
    res.setHeader('Content-Type', document.fileType);
    res.send(buffer);
  }

  @Post('upload')
  @Roles(Role.ACCOUNTANT, Role.PROJECT_MANAGER, Role.CFO, Role.CEO)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('category') category: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const resolvedCategory = category ?? DocumentCategory.BILL;
    if (!Object.values(DocumentCategory).includes(resolvedCategory as DocumentCategory)) {
      throw new BadRequestException('ประเภทเอกสารไม่ถูกต้อง');
    }
    return this.documentsService.upload(file, user.userId, resolvedCategory as DocumentCategory);
  }

  @Post(':id/confirm')
  @Roles(Role.ACCOUNTANT, Role.CFO, Role.CEO)
  confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.confirm(id, dto, user.userId);
  }

  @Post(':id/import-boq-items')
  @Roles(Role.ACCOUNTANT, Role.PROJECT_MANAGER, Role.CFO, Role.CEO)
  importBoqItems(
    @Param('id') id: string,
    @Body() dto: ImportBoqItemsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.importBoqItems(id, dto, user.userId);
  }

  @Post(':id/reject')
  @Roles(Role.ACCOUNTANT, Role.CFO, Role.CEO)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.reject(id, user.userId, dto.notes);
  }
}
