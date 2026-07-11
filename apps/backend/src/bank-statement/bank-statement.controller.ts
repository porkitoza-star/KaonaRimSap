import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BankStatementService } from './bank-statement.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bank-statement')
export class BankStatementController {
  constructor(private bankStatementService: BankStatementService) {}

  @Post('parse')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  parse(@UploadedFile() file: Express.Multer.File, @Body('password') password?: string) {
    return this.bankStatementService.parsePdf(file.buffer, password);
  }
}
