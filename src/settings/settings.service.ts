import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async create(createSettingDto: CreateSettingDto) {
    return this.prisma.setting.create({
      data: createSettingDto,
    });
  }

  async findAll() {
    const settings = await this.prisma.setting.findMany();
    
    // Transform array of settings to flat object for frontend
    const settingsObj: Record<string, any> = {};
    settings.forEach((setting) => {
      settingsObj[setting.key] = setting.value;
    });
    
    return settingsObj;
  }

  async findOne(key: string) {
    const setting = await this.prisma.setting.findUnique({
      where: { key },
    });
    if (!setting) {
      throw new NotFoundException(`Setting with key ${key} not found`);
    }
    return setting;
  }

  async update(key: string, updateSettingDto: UpdateSettingDto) {
    return this.prisma.setting.upsert({
      where: { key },
      update: updateSettingDto as any,
      create: {
        key,
        value: updateSettingDto.value ?? {},
        category: updateSettingDto.category,
      },
    });
  }

  async remove(key: string) {
    return this.prisma.setting.delete({
      where: { key },
    });
  }

  async updateThemeSettings(themeData: any) {
    // Save each theme setting as a separate setting record
    const themeKeys = [
      'siteTitle',
      'siteTagline',
      'logoUrl',
      'faviconUrl',
      'primaryColor',
      'secondaryColor',
      'accentColor',
      'backgroundColor',
      'textColor',
      'headingFont',
      'bodyFont',
      'contactEmail',
      'contactPhone',
      'contactAddress',
      'footerText',
      'footerLinks',
      'socialLinks',
      'metaDescription',
      'metaKeywords',
    ];

    const results = [];
    for (const key of themeKeys) {
      if (themeData[key] !== undefined) {
        const settingKey = `theme_${key}`;
        const result = await this.prisma.setting.upsert({
          where: { key: settingKey },
          update: {
            value: themeData[key],
            category: 'theme',
          },
          create: {
            key: settingKey,
            value: themeData[key],
            category: 'theme',
          },
        });
        results.push(result);
      }
    }

    // Return the complete theme object
    return this.getThemeSettings();
  }

  async getThemeSettings() {
    const settings = await this.prisma.setting.findMany({
      where: { category: 'theme' },
    });

    const theme: any = {};
    settings.forEach((setting) => {
      const key = setting.key.replace('theme_', '');
      theme[key] = setting.value;
    });

    // Return default theme if no settings found
    if (Object.keys(theme).length === 0) {
      return {
        siteTitle: 'Kaksingri Denim',
        siteTagline: 'Born by the Lake, Crafted by Hand',
        logoUrl: '',
        faviconUrl: '',
        primaryColor: '#30475E',
        secondaryColor: '#CD7F32',
        accentColor: '#CD7F32',
        backgroundColor: '#FFFFFF',
        textColor: '#1F2937',
        headingFont: 'Inter',
        bodyFont: 'Inter',
        contactEmail: 'info@kaksingridenim.com',
        contactPhone: '+254712345678',
        contactAddress: 'Nairobi, Kenya',
        footerText: '© 2024 Kaksingri Denim. All rights reserved.',
        footerLinks: [],
        socialLinks: {},
        metaDescription: 'Premium denim crafted by hand',
        metaKeywords: 'denim, jeans, handmade, kenya',
      };
    }

    return theme;
  }

  async bulkUpdate(settingsData: Record<string, any>) {
    // Map of setting keys to their categories
    const settingCategories: Record<string, string> = {
      whatsappApiKey: 'whatsapp',
      whatsappApiUrl: 'whatsapp',
      adminWhatsapp: 'whatsapp',
      orderConfirmationTemplate: 'whatsapp',
      stockAlertTemplate: 'whatsapp',
      orderUpdateTemplate: 'whatsapp',
      paymentGateway: 'payment',
      mpesaApiKey: 'payment',
      mpesaApiSecret: 'payment',
      stripeApiKey: 'payment',
      stripeSecretKey: 'payment',
      paypalClientId: 'payment',
      defaultShippingRate: 'shipping',
      freeShippingThreshold: 'shipping',
      shippingZones: 'shipping',
      smtpHost: 'email',
      smtpPort: 'email',
      smtpUser: 'email',
      smtpPassword: 'email',
      emailFrom: 'email',
      googleAnalyticsId: 'integrations',
      facebookPixelId: 'integrations',
    };

    const results = [];
    for (const [key, value] of Object.entries(settingsData)) {
      if (value !== undefined && value !== null) {
        const category = settingCategories[key] || 'general';
        const result = await this.prisma.setting.upsert({
          where: { key },
          update: {
            value: value,
            category: category,
          },
          create: {
            key,
            value: value,
            category: category,
          },
        });
        results.push(result);
      }
    }

    // Return all settings
    return this.findAll();
  }
}

