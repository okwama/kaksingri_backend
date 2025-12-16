import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import axios, { AxiosInstance } from 'axios';

export interface WhatsAppConfig {
  apiUrl: string;
  apiKey: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  adminPhone: string;
  templates: {
    orderConfirmation: string;
    stockAlert: string;
    orderUpdate: string;
  };
}

export interface WhatsAppMessage {
  to: string;
  message: string;
  type?: 'order_confirmation' | 'stock_alert' | 'order_update' | 'custom';
}

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private config: WhatsAppConfig | null = null;
  private httpClient: AxiosInstance | null = null;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.initializeConfig();
  }

  private async initializeConfig() {
    try {
      this.config = await this.getWhatsAppConfig();
      if (this.config && this.config.apiUrl && this.config.apiKey) {
        this.httpClient = axios.create({
          baseURL: this.config.apiUrl,
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        });
        console.log('WhatsApp service initialized successfully');
      } else {
        console.warn('WhatsApp configuration not found. WhatsApp service disabled.');
      }
    } catch (error) {
      console.error('Failed to initialize WhatsApp service:', error);
      this.httpClient = null;
    }
  }

  private async getWhatsAppConfig(): Promise<WhatsAppConfig | null> {
    try {
      const settings = await this.prisma.setting.findMany({
        where: {
          key: {
            in: [
              'whatsappApiKey',
              'whatsappApiUrl',
              'adminWhatsapp',
              'orderConfirmationTemplate',
              'stockAlertTemplate',
              'orderUpdateTemplate',
            ],
          },
        },
      });

      const settingsMap: Record<string, any> = {};
      settings.forEach((setting) => {
        settingsMap[setting.key] = setting.value;
      });

      if (!settingsMap.whatsappApiKey || !settingsMap.whatsappApiUrl) {
        // Fallback to environment variables
        if (process.env.WHATSAPP_API_KEY && process.env.WHATSAPP_API_URL) {
          return {
            apiUrl: process.env.WHATSAPP_API_URL,
            apiKey: process.env.WHATSAPP_API_KEY,
            phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
            businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
            adminPhone: process.env.ADMIN_WHATSAPP || '+254700000000',
            templates: {
              orderConfirmation:
                settingsMap.orderConfirmationTemplate ||
                process.env.WHATSAPP_ORDER_CONFIRMATION_TEMPLATE ||
                '🎉 Your Kaksingri Denim order #{orderNumber} has been confirmed!\n\n{orderDetails}\n\nThank you for your purchase!',
              stockAlert:
                settingsMap.stockAlertTemplate ||
                process.env.WHATSAPP_STOCK_ALERT_TEMPLATE ||
                '✨ Great news! {productName} is back in stock at Kaksingri Denim!\n\nShop now: {catalogueUrl}',
              orderUpdate:
                settingsMap.orderUpdateTemplate ||
                process.env.WHATSAPP_ORDER_UPDATE_TEMPLATE ||
                '📦 Update on your order #{orderNumber}: {status}\n\nTrack your order: {orderUrl}',
            },
          };
        }
        return null;
      }

      return {
        apiUrl: settingsMap.whatsappApiUrl as string,
        apiKey: settingsMap.whatsappApiKey as string,
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
        adminPhone: (settingsMap.adminWhatsapp as string) || process.env.ADMIN_WHATSAPP || '+254700000000',
        templates: {
          orderConfirmation:
            (settingsMap.orderConfirmationTemplate as string) ||
            '🎉 Your Kaksingri Denim order #{orderNumber} has been confirmed!\n\n{orderDetails}\n\nThank you for your purchase!',
          stockAlert:
            (settingsMap.stockAlertTemplate as string) ||
            '✨ Great news! {productName} is back in stock at Kaksingri Denim!\n\nShop now: {catalogueUrl}',
          orderUpdate:
            (settingsMap.orderUpdateTemplate as string) ||
            '📦 Update on your order #{orderNumber}: {status}\n\nTrack your order: {orderUrl}',
        },
      };
    } catch (error) {
      console.error('Error getting WhatsApp config:', error);
      return null;
    }
  }

  async updateWhatsAppConfig(config: Partial<WhatsAppConfig>): Promise<void> {
    // Update settings in database
    if (config.apiUrl) {
      await this.prisma.setting.upsert({
        where: { key: 'whatsappApiUrl' },
        update: { value: config.apiUrl, category: 'whatsapp' },
        create: { key: 'whatsappApiUrl', value: config.apiUrl, category: 'whatsapp' },
      });
    }

    if (config.apiKey) {
      await this.prisma.setting.upsert({
        where: { key: 'whatsappApiKey' },
        update: { value: config.apiKey, category: 'whatsapp' },
        create: { key: 'whatsappApiKey', value: config.apiKey, category: 'whatsapp' },
      });
    }

    if (config.adminPhone) {
      await this.prisma.setting.upsert({
        where: { key: 'adminWhatsapp' },
        update: { value: config.adminPhone, category: 'whatsapp' },
        create: { key: 'adminWhatsapp', value: config.adminPhone, category: 'whatsapp' },
      });
    }

    if (config.templates) {
      if (config.templates.orderConfirmation) {
        await this.prisma.setting.upsert({
          where: { key: 'orderConfirmationTemplate' },
          update: { value: config.templates.orderConfirmation, category: 'whatsapp' },
          create: { key: 'orderConfirmationTemplate', value: config.templates.orderConfirmation, category: 'whatsapp' },
        });
      }

      if (config.templates.stockAlert) {
        await this.prisma.setting.upsert({
          where: { key: 'stockAlertTemplate' },
          update: { value: config.templates.stockAlert, category: 'whatsapp' },
          create: { key: 'stockAlertTemplate', value: config.templates.stockAlert, category: 'whatsapp' },
        });
      }

      if (config.templates.orderUpdate) {
        await this.prisma.setting.upsert({
          where: { key: 'orderUpdateTemplate' },
          update: { value: config.templates.orderUpdate, category: 'whatsapp' },
          create: { key: 'orderUpdateTemplate', value: config.templates.orderUpdate, category: 'whatsapp' },
        });
      }
    }

    // Reinitialize with new config
    await this.initializeConfig();
  }

  async getWhatsAppConfigPublic(): Promise<Partial<WhatsAppConfig>> {
    const config = await this.getWhatsAppConfig();
    if (!config) return {};

    // Return config without sensitive API key
    return {
      apiUrl: config.apiUrl,
      adminPhone: config.adminPhone,
      templates: config.templates,
      apiKey: config.apiKey ? '••••••••' : '',
    };
  }

  async sendMessage(message: WhatsAppMessage): Promise<boolean> {
    if (!this.httpClient || !this.config) {
      console.warn('WhatsApp service not initialized. Cannot send message.');
      return false;
    }

    try {
      // Format phone number (remove + and spaces, ensure it starts with country code)
      const phoneNumber = this.formatPhoneNumber(message.to);

      // For WhatsApp Business API, the endpoint structure may vary
      // This is a generic implementation - adjust based on your provider
      const payload = {
        to: phoneNumber,
        message: message.message,
        type: message.type || 'custom',
      };

      // Try different API endpoint structures
      // Option 1: Generic REST API
      try {
        await this.httpClient.post('/send', payload);
        console.log(`WhatsApp message sent successfully to ${phoneNumber}`);
        return true;
      } catch (error: any) {
        // Option 2: WhatsApp Business API format
        if (this.config.phoneNumberId) {
          try {
            await this.httpClient.post(`/${this.config.phoneNumberId}/messages`, {
              messaging_product: 'whatsapp',
              to: phoneNumber,
              type: 'text',
              text: { body: message.message },
            });
            console.log(`WhatsApp message sent successfully to ${phoneNumber}`);
            return true;
          } catch (error2: any) {
            console.error('WhatsApp API error:', error2.response?.data || error2.message);
            throw error2;
          }
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error.response?.data || error.message);
      return false;
    }
  }

  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // If it doesn't start with a country code, assume Kenya (+254)
    if (!cleaned.startsWith('254') && cleaned.length === 9) {
      cleaned = '254' + cleaned;
    }

    return cleaned;
  }

  // Template methods for common messages
  async sendOrderConfirmation(order: any, customerPhone: string): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    const orderDetails = order.items
      ?.map((item: any) => `${item.product?.name || 'N/A'} x${item.quantity}`)
      .join('\n') || 'N/A';

    const message = this.config.templates.orderConfirmation
      .replace(/{orderNumber}/g, order.orderNumber)
      .replace(/{orderDetails}/g, orderDetails)
      .replace(/{total}/g, `KES ${Number(order.total).toFixed(2)}`);

    return this.sendMessage({
      to: customerPhone,
      message,
      type: 'order_confirmation',
    });
  }

  async sendStockAlert(product: any, customerPhone: string, catalogueUrl?: string): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    const url = catalogueUrl || `${process.env.FRONTEND_URL || 'https://kaksingridenim.com'}/catalogue`;

    const message = this.config.templates.stockAlert
      .replace(/{productName}/g, product.name)
      .replace(/{catalogueUrl}/g, url);

    return this.sendMessage({
      to: customerPhone,
      message,
      type: 'stock_alert',
    });
  }

  async sendOrderUpdate(order: any, customerPhone: string, status: string): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    const orderUrl = `${process.env.FRONTEND_URL || 'https://kaksingridenim.com'}/orders/${order.id}`;

    const message = this.config.templates.orderUpdate
      .replace(/{orderNumber}/g, order.orderNumber)
      .replace(/{status}/g, status)
      .replace(/{orderUrl}/g, orderUrl);

    return this.sendMessage({
      to: customerPhone,
      message,
      type: 'order_update',
    });
  }

  async notifyAdmin(message: string): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    return this.sendMessage({
      to: this.config.adminPhone,
      message,
      type: 'custom',
    });
  }

  async sendTestMessage(phone: string): Promise<boolean> {
    const message = '🧪 Test message from Kaksingri Denim admin panel.\n\nIf you received this message, your WhatsApp configuration is working correctly!';
    return this.sendMessage({
      to: phone,
      message,
      type: 'custom',
    });
  }
}

