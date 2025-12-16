import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import * as crypto from 'crypto';

@Injectable()
export class PaymentMethodsService implements OnModuleInit {
  private encryptionKey: string;
  private readonly algorithm = 'aes-256-cbc';

  constructor(private prisma: PrismaService) {
    // Initialize with env or generate temporary key
    const envKey = process.env.PAYMENT_ENCRYPTION_KEY;
    if (envKey && envKey.length === 64) {
      this.encryptionKey = envKey;
    } else {
      // Temporary key, will be replaced in onModuleInit
      this.encryptionKey = crypto.randomBytes(32).toString('hex');
    }
  }

  async onModuleInit() {
    // Initialize encryption key from database or env
    await this.initializeKey();
  }

  private async initializeKey(): Promise<void> {
    try {
      // Try to get from database settings
      const setting = await this.prisma.setting.findUnique({
        where: { key: 'payment_encryption_key' },
      });

      if (setting && typeof setting.value === 'string' && setting.value.length === 64) {
        this.encryptionKey = setting.value;
        return;
      }
    } catch (error) {
      // Database might not be ready yet, continue to env/fallback
    }

    // Try environment variable
    const envKey = process.env.PAYMENT_ENCRYPTION_KEY;
    if (envKey && envKey.length === 64) {
      this.encryptionKey = envKey;
      // Save to database for future use
      try {
        await this.prisma.setting.upsert({
          where: { key: 'payment_encryption_key' },
          update: { value: envKey, category: 'payment' },
          create: { key: 'payment_encryption_key', value: envKey, category: 'payment' },
        });
      } catch (error) {
        // Ignore if can't save
      }
      return;
    }

    // Generate a new key and store it in database
    const newKey = crypto.randomBytes(32).toString('hex');
    this.encryptionKey = newKey;
    try {
      await this.prisma.setting.upsert({
        where: { key: 'payment_encryption_key' },
        update: { value: newKey, category: 'payment' },
        create: { key: 'payment_encryption_key', value: newKey, category: 'payment' },
      });
    } catch (error) {
      console.warn('Could not save encryption key to database.');
    }
  }

  async getEncryptionKeySetting(): Promise<{ key: string; source: 'database' | 'environment' | 'generated'; masked: string }> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key: 'payment_encryption_key' },
      });

      if (setting && typeof setting.value === 'string' && setting.value.length === 64) {
        return {
          key: setting.value,
          source: 'database',
          masked: '••••' + setting.value.slice(-8),
        };
      }
    } catch (error) {
      // Ignore
    }

    const envKey = process.env.PAYMENT_ENCRYPTION_KEY;
    if (envKey && envKey.length === 64) {
      return {
        key: envKey,
        source: 'environment',
        masked: '••••' + envKey.slice(-8),
      };
    }

    return {
      key: this.encryptionKey,
      source: 'generated',
      masked: '••••' + this.encryptionKey.slice(-8),
    };
  }

  async setEncryptionKey(key: string, regenerateCredentials: boolean = false): Promise<void> {
    if (key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key)) {
      throw new BadRequestException('Encryption key must be exactly 64 hexadecimal characters');
    }

    const oldKey = this.encryptionKey;

    // If regenerating, we need to re-encrypt all existing credentials
    if (regenerateCredentials) {
      const methods = await this.prisma.paymentMethod.findMany();

      for (const method of methods) {
        try {
          // Decrypt with old key
          const oldCredentials = method.credentials as Record<string, any>;
          const decrypted: Record<string, any> = {};
          for (const [k, v] of Object.entries(oldCredentials)) {
            if (typeof v === 'string' && v.includes(':')) {
              try {
                // Try to decrypt with old key
                const parts = v.split(':');
                const iv = Buffer.from(parts[0], 'hex');
                const encrypted = parts[1];
                const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(oldKey, 'hex'), iv);
                let decryptedValue = decipher.update(encrypted, 'hex', 'utf8');
                decryptedValue += decipher.final('utf8');
                decrypted[k] = decryptedValue;
              } catch {
                decrypted[k] = v; // If decryption fails, keep as is
              }
            } else {
              decrypted[k] = v;
            }
          }

          // Temporarily set new key to encrypt
          this.encryptionKey = key;
          // Re-encrypt with new key
          const reEncrypted = this.encryptCredentials(decrypted);

          await this.prisma.paymentMethod.update({
            where: { id: method.id },
            data: { credentials: reEncrypted as any },
          });
        } catch (error) {
          console.error(`Failed to re-encrypt credentials for payment method ${method.id}:`, error);
        }
      }
    }

    // Update the key in database
    await this.prisma.setting.upsert({
      where: { key: 'payment_encryption_key' },
      update: { value: key, category: 'payment' },
      create: { key: 'payment_encryption_key', value: key, category: 'payment' },
    });

    this.encryptionKey = key;
  }

  async generateNewKey(): Promise<string> {
    return crypto.randomBytes(32).toString('hex');
  }

  private encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const keyBuffer = Buffer.from(this.encryptionKey, 'hex');
      const cipher = crypto.createCipheriv(this.algorithm, keyBuffer, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt credentials');
    }
  }

  private decrypt(encryptedText: string): string {
    try {
      if (!encryptedText || !encryptedText.includes(':')) {
        return encryptedText; // Not encrypted, return as is
      }
      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        return encryptedText; // Invalid format, return as is
      }
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const keyBuffer = Buffer.from(this.encryptionKey, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, keyBuffer, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      // Return masked value if decryption fails
      return '••••••••';
    }
  }

  private encryptCredentials(credentials: Record<string, any>): Record<string, any> {
    const encrypted: Record<string, any> = {};
    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value === 'string' && (
        key.toLowerCase().includes('key') || 
        key.toLowerCase().includes('secret') || 
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('passkey') ||
        key.toLowerCase().includes('password')
      )) {
        encrypted[key] = this.encrypt(value);
      } else {
        encrypted[key] = value;
      }
    }
    return encrypted;
  }

  private decryptCredentials(credentials: Record<string, any>): Record<string, any> {
    const decrypted: Record<string, any> = {};
    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value === 'string' && value.includes(':')) {
        try {
          decrypted[key] = this.decrypt(value);
        } catch {
          decrypted[key] = value; // If decryption fails, return as is (might not be encrypted)
        }
      } else {
        decrypted[key] = value;
      }
    }
    return decrypted;
  }

  async create(createPaymentMethodDto: CreatePaymentMethodDto) {
    // If setting as default, unset other defaults
    if (createPaymentMethodDto.isDefault) {
      await this.prisma.paymentMethod.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    // Encrypt sensitive credentials
    const encryptedCredentials = this.encryptCredentials(createPaymentMethodDto.credentials);

    return this.prisma.paymentMethod.create({
      data: {
        name: createPaymentMethodDto.name,
        type: createPaymentMethodDto.type,
        isActive: createPaymentMethodDto.isActive ?? true,
        isDefault: createPaymentMethodDto.isDefault ?? false,
        credentials: encryptedCredentials as any,
        config: createPaymentMethodDto.config as any,
        description: createPaymentMethodDto.description,
      },
    });
  }

  async findAll(includeCredentials: boolean = false) {
    const methods = await this.prisma.paymentMethod.findMany({
      orderBy: [{ isDefault: 'desc' }, { isActive: 'desc' }, { createdAt: 'desc' }],
    });

    if (includeCredentials) {
      return methods.map((method) => {
        try {
          return {
            ...method,
            credentials: this.decryptCredentials(method.credentials as Record<string, any>),
          };
        } catch (error) {
          console.error(`Failed to decrypt credentials for payment method ${method.id}:`, error);
          // Return masked credentials if decryption fails
          return {
            ...method,
            credentials: this.maskCredentials(method.credentials as Record<string, any>),
            decryptionError: true,
          };
        }
      });
    }

    // Return methods with masked credentials
    return methods.map((method) => ({
      ...method,
      credentials: this.maskCredentials(method.credentials as Record<string, any>),
    }));
  }

  async findOne(id: string, includeCredentials: boolean = false) {
    const method = await this.prisma.paymentMethod.findUnique({
      where: { id },
    });

    if (!method) {
      throw new NotFoundException(`Payment method with ID ${id} not found`);
    }

    if (includeCredentials) {
      try {
        return {
          ...method,
          credentials: this.decryptCredentials(method.credentials as Record<string, any>),
        };
      } catch (error) {
        console.error(`Failed to decrypt credentials for payment method ${id}:`, error);
        // Return masked credentials if decryption fails
        return {
          ...method,
          credentials: this.maskCredentials(method.credentials as Record<string, any>),
          decryptionError: true,
        };
      }
    }

    return {
      ...method,
      credentials: this.maskCredentials(method.credentials as Record<string, any>),
    };
  }

  async update(id: string, updatePaymentMethodDto: UpdatePaymentMethodDto) {
    const existing = await this.prisma.paymentMethod.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Payment method with ID ${id} not found`);
    }

    // If setting as default, unset other defaults
    if (updatePaymentMethodDto.isDefault) {
      await this.prisma.paymentMethod.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updateData: any = {
      name: updatePaymentMethodDto.name,
      type: updatePaymentMethodDto.type,
      isActive: updatePaymentMethodDto.isActive,
      isDefault: updatePaymentMethodDto.isDefault,
      description: updatePaymentMethodDto.description,
    };

    // Encrypt credentials if provided
    if (updatePaymentMethodDto.credentials) {
      updateData.credentials = this.encryptCredentials(updatePaymentMethodDto.credentials);
    }

    if (updatePaymentMethodDto.config) {
      updateData.config = updatePaymentMethodDto.config;
    }

    return this.prisma.paymentMethod.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.paymentMethod.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Payment method with ID ${id} not found`);
    }

    // Check if payment method is used in orders
    const orderCount = await this.prisma.order.count({
      where: { paymentMethodId: id },
    });

    if (orderCount > 0) {
      throw new BadRequestException(
        `Cannot delete payment method that is used in ${orderCount} order(s). Please deactivate it instead.`,
      );
    }

    return this.prisma.paymentMethod.delete({
      where: { id },
    });
  }

  async getActiveMethods() {
    const methods = await this.prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    // Return only public info (no credentials)
    return methods.map((method) => ({
      id: method.id,
      name: method.name,
      type: method.type,
      isDefault: method.isDefault,
      description: method.description,
    }));
  }

  private maskCredentials(credentials: Record<string, any>): Record<string, any> {
    const masked: Record<string, any> = {};
    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value === 'string' && (key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('token'))) {
        // Mask sensitive values (show only last 4 characters)
        masked[key] = value.length > 4 ? '••••' + value.slice(-4) : '••••';
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }
}
