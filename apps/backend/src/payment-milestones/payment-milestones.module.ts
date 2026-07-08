import { Module } from '@nestjs/common';
import { PaymentMilestonesService } from './payment-milestones.service';
import { PaymentMilestonesController } from './payment-milestones.controller';

@Module({
  providers: [PaymentMilestonesService],
  controllers: [PaymentMilestonesController],
})
export class PaymentMilestonesModule {}
