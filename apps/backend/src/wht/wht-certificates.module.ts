import { Module } from '@nestjs/common';
import { WhtCertificatesService } from './wht-certificates.service';
import { WhtCertificatesController } from './wht-certificates.controller';

@Module({
  providers: [WhtCertificatesService],
  controllers: [WhtCertificatesController],
  exports: [WhtCertificatesService],
})
export class WhtCertificatesModule {}
