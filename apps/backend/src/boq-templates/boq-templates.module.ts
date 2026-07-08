import { Module } from '@nestjs/common';
import { BoqTemplatesService } from './boq-templates.service';
import { BoqTemplatesController } from './boq-templates.controller';

@Module({
  providers: [BoqTemplatesService],
  controllers: [BoqTemplatesController],
})
export class BoqTemplatesModule {}
