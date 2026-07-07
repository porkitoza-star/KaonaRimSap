import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { JournalService } from './journal.service';
import { CreateManualJournalEntryDto } from './dto/create-manual-journal-entry.dto';
import { AuditService } from '../audit/audit.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('journal-entries')
export class JournalController {
  constructor(
    private journalService: JournalService,
    private audit: AuditService,
  ) {}

  @Get()
  findAll(@Query('costCenterId') costCenterId?: string, @Query('accountId') accountId?: string) {
    return this.journalService.findAll({ costCenterId, accountId });
  }

  @Post()
  @Roles(Role.CFO, Role.CEO)
  async create(
    @Body() dto: CreateManualJournalEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const entry = await this.journalService.postEntry({
      entryDate: new Date(dto.entryDate),
      description: dto.description,
      sourceType: 'MANUAL',
      createdById: user.userId,
      lines: dto.lines,
    });
    await this.audit.log({
      userId: user.userId,
      action: 'CREATE',
      entityType: 'JournalEntry',
      entityId: entry.id,
      after: entry,
    });
    return entry;
  }
}
