import {
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
import { DocumentStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import { ConfirmDocumentDto } from './dto/confirm-document.dto';
import { RejectDocumentDto } from './dto/reject-document.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Get()
  findAll(@Query('status') status?: DocumentStatus) {
    return this.documentsService.findAll(status);
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
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.upload(file, user.userId);
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
