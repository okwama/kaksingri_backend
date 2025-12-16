import { Module, forwardRef } from '@nestjs/common';
import { EmailService } from './email.service';
import { WhatsAppService } from './whatsapp.service';
import { NotificationsController } from './notifications.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  providers: [EmailService, WhatsAppService],
  controllers: [NotificationsController],
  exports: [EmailService, WhatsAppService],
})
export class NotificationsModule {}
