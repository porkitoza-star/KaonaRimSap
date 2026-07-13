import { Body, Controller, Get, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { LedgerImportService } from './ledger-import.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ledger-import')
export class LedgerImportController {
  constructor(private ledgerImportService: LedgerImportService) {}

  @Post('preview')
  @Roles(Role.ACCOUNTANT, Role.CFO, Role.CEO)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  preview(@UploadedFile() file: Express.Multer.File) {
    return this.ledgerImportService.preview(file.buffer);
  }

  // Commit writes real Bills/Invoices/Payments (and settles them immediately),
  // so it is restricted to CEO — this bulk-imports historical financial data
  // straight into the live books.
  @Post('commit')
  @Roles(Role.CEO)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  commit(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
    @Body('forceDuplicates') forceDuplicates?: string,
  ) {
    return this.ledgerImportService.commit(file.buffer, user.userId, file.originalname, forceDuplicates === 'true');
  }

  @Get('history')
  @Roles(Role.ACCOUNTANT, Role.CFO, Role.CEO)
  history() {
    return this.ledgerImportService.listImportHistory();
  }
}
