import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmailService, EmailConfig } from './email.service';
import { WhatsAppService, WhatsAppConfig, WhatsAppMessage } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  @Get('email/config')
  @ApiOperation({ summary: 'Get email configuration' })
  async getEmailConfig() {
    return this.emailService.getEmailConfigPublic();
  }

  @Post('email/config')
  @ApiOperation({ summary: 'Update email configuration' })
  async updateEmailConfig(@Body() config: Partial<EmailConfig>) {
    await this.emailService.updateEmailConfig(config);
    return { success: true, message: 'Email configuration updated successfully' };
  }

  @Post('email/test')
  @ApiOperation({ summary: 'Send test email' })
  async sendTestEmail(@Body() body: { to: string }) {
    const sent = await this.emailService.sendEmail({
      to: body.to,
      subject: 'Test Email from Kaksingri Denim',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email from Kaksingri Denim admin panel.</p>
        <p>If you received this email, your email configuration is working correctly!</p>
      `,
    });

    return {
      success: sent,
      message: sent
        ? 'Test email sent successfully'
        : 'Failed to send test email. Please check your configuration.',
    };
  }

  @Get('whatsapp/config')
  @ApiOperation({ summary: 'Get WhatsApp configuration' })
  async getWhatsAppConfig() {
    return this.whatsappService.getWhatsAppConfigPublic();
  }

  @Post('whatsapp/config')
  @ApiOperation({ summary: 'Update WhatsApp configuration' })
  async updateWhatsAppConfig(@Body() config: Partial<WhatsAppConfig>) {
    await this.whatsappService.updateWhatsAppConfig(config);
    return { success: true, message: 'WhatsApp configuration updated successfully' };
  }

  @Post('whatsapp/test')
  @ApiOperation({ summary: 'Send test WhatsApp message' })
  async sendTestWhatsApp(@Body() body: { to: string }) {
    const sent = await this.whatsappService.sendTestMessage(body.to);
    return {
      success: sent,
      message: sent
        ? 'Test WhatsApp message sent successfully'
        : 'Failed to send test WhatsApp message. Please check your configuration.',
    };
  }

  @Post('whatsapp/send')
  @ApiOperation({ summary: 'Send WhatsApp message' })
  async sendWhatsApp(@Body() message: WhatsAppMessage) {
    const sent = await this.whatsappService.sendMessage(message);
    return {
      success: sent,
      message: sent ? 'WhatsApp message sent successfully' : 'Failed to send WhatsApp message',
    };
  }

  @Get('email/preferences')
  @ApiOperation({ summary: 'Get email notification preferences' })
  async getEmailPreferences() {
    return this.emailService.getEmailPreferences();
  }

  @Post('email/preferences')
  @ApiOperation({ summary: 'Update email notification preferences' })
  async updateEmailPreferences(@Body() preferences: Record<string, boolean>) {
    await this.emailService.updateEmailPreferences(preferences);
    return { success: true, message: 'Email preferences updated successfully' };
  }
}
