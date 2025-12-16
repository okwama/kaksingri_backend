import { Module, forwardRef } from '@nestjs/common';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentProcessingController } from './payment-processing.controller';
import { PaymentProcessingService } from './payment-processing.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [forwardRef(() => NotificationsModule), LoyaltyModule],
  controllers: [PaymentMethodsController, PaymentProcessingController],
  providers: [PaymentMethodsService, PaymentProcessingService],
  exports: [PaymentMethodsService, PaymentProcessingService],
})
export class PaymentsModule {}

