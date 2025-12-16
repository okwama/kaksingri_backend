import { Injectable, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../common/prisma.service';
import { Transporter } from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  fromName: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content?: Buffer | string;
    path?: string;
    contentType?: string;
  }>;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: Transporter | null = null;
  private config: EmailConfig | null = null;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.initializeTransporter();
  }

  private async initializeTransporter() {
    try {
      this.config = await this.getEmailConfig();
      if (this.config && this.config.host) {
        this.transporter = nodemailer.createTransport({
          host: this.config.host,
          port: this.config.port,
          secure: this.config.secure, // true for 465, false for other ports
          auth: {
            user: this.config.auth.user,
            pass: this.config.auth.pass,
          },
        });

        // Verify connection
        await this.transporter.verify();
        console.log('Email service initialized successfully');
      } else {
        console.warn('Email configuration not found. Email service disabled.');
      }
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      this.transporter = null;
    }
  }

  private async getEmailConfig(): Promise<EmailConfig | null> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key: 'email_config' },
      });

      if (setting && setting.value) {
        const config = setting.value as any;
        return {
          host: config.host || process.env.SMTP_HOST || 'smtp.mailtrap.io',
          port: config.port || parseInt(process.env.SMTP_PORT || '2525'),
          secure: config.secure ?? (process.env.SMTP_SECURE === 'true'),
          auth: {
            user: config.auth?.user || process.env.SMTP_USER || '',
            pass: config.auth?.pass || process.env.SMTP_PASS || '',
          },
          from: config.from || process.env.SMTP_FROM || 'noreply@kaksingri.com',
          fromName: config.fromName || process.env.SMTP_FROM_NAME || 'Kaksingri Denim',
        };
      }

      // Fallback to environment variables
      if (process.env.SMTP_HOST) {
        return {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '2525'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || '',
          },
          from: process.env.SMTP_FROM || 'noreply@kaksingri.com',
          fromName: process.env.SMTP_FROM_NAME || 'Kaksingri Denim',
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting email config:', error);
      return null;
    }
  }

  async updateEmailConfig(config: Partial<EmailConfig>): Promise<void> {
    const currentConfig = await this.getEmailConfig();
    const newConfig: EmailConfig = {
      ...currentConfig,
      ...config,
      auth: {
        ...currentConfig?.auth,
        ...config.auth,
      },
    } as EmailConfig;

    await this.prisma.setting.upsert({
      where: { key: 'email_config' },
      update: {
        value: newConfig as any,
        category: 'email',
      },
      create: {
        key: 'email_config',
        value: newConfig as any,
        category: 'email',
      },
    });

    // Reinitialize transporter with new config
    await this.initializeTransporter();
  }

  async getEmailConfigPublic(): Promise<Partial<EmailConfig>> {
    const config = await this.getEmailConfig();
    if (!config) return {};

    // Return config without sensitive password
    return {
      host: config.host,
      port: config.port,
      secure: config.secure,
      from: config.from,
      fromName: config.fromName,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass ? '••••••••' : '',
      },
    };
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      console.warn('Email service not initialized. Cannot send email.');
      return false;
    }

    try {
      const config = await this.getEmailConfig();
      if (!config) {
        throw new Error('Email configuration not found');
      }

      const mailOptions = {
        from: `"${config.fromName}" <${config.from}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        attachments: options.attachments,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  // Template methods for common emails
  async sendOrderConfirmation(order: any, customerEmail: string): Promise<boolean> {
    // Check if order confirmation emails are enabled
    if (!(await this.isEmailTypeEnabled('orderConfirmation'))) {
      return false;
    }
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .order-details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f3f4f6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Order Confirmation</h1>
            </div>
            <div class="content">
              <p>Thank you for your order! We've received your order and will begin processing it shortly.</p>
              
              <div class="order-details">
                <h2>Order Details</h2>
                <p><strong>Order Number:</strong> ${order.orderNumber}</p>
                <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
                <p><strong>Total Amount:</strong> KES ${Number(order.total).toFixed(2)}</p>
              </div>

              <div class="order-details">
                <h3>Order Items</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${order.items?.map((item: any) => `
                      <tr>
                        <td>${item.product?.name || 'N/A'}</td>
                        <td>${item.quantity}</td>
                        <td>KES ${Number(item.unitPrice).toFixed(2)}</td>
                      </tr>
                    `).join('') || ''}
                  </tbody>
                </table>
              </div>

              <div class="order-details">
                <h3>Shipping Address</h3>
                <p>${order.shippingAddress ? Object.values(order.shippingAddress).filter(Boolean).join(', ') : 'N/A'}</p>
              </div>

              <p>We'll send you another email when your order ships.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Kaksingri Denim. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: customerEmail,
      subject: `Order Confirmation - ${order.orderNumber}`,
      html,
    });
  }

  async sendShippingUpdate(order: any, customerEmail: string, trackingNumber?: string): Promise<boolean> {
    // Check if shipping update emails are enabled
    if (!(await this.isEmailTypeEnabled('shippingUpdate'))) {
      return false;
    }
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #059669; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your Order Has Shipped!</h1>
            </div>
            <div class="content">
              <p>Great news! Your order <strong>${order.orderNumber}</strong> has been shipped.</p>
              ${trackingNumber ? `<p><strong>Tracking Number:</strong> ${trackingNumber}</p>` : ''}
              <p>You can expect to receive your order within the next few business days.</p>
              <p>Thank you for shopping with Kaksingri Denim!</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Kaksingri Denim. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: customerEmail,
      subject: `Your Order ${order.orderNumber} Has Shipped`,
      html,
    });
  }

  async sendPasswordReset(email: string, resetToken: string, resetUrl: string): Promise<boolean> {
    // Check if password reset emails are enabled
    if (!(await this.isEmailTypeEnabled('passwordReset'))) {
      return false;
    }
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #DC2626; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p>You requested to reset your password. Click the button below to reset it:</p>
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all;">${resetUrl}</p>
              <p>This link will expire in 1 hour.</p>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Kaksingri Denim. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Password Reset Request - Kaksingri Denim',
      html,
    });
  }

  async sendPaymentConfirmation(order: any, customerEmail: string): Promise<boolean> {
    // Check if payment confirmation emails are enabled
    if (!(await this.isEmailTypeEnabled('paymentConfirmation'))) {
      return false;
    }
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #059669; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Received</h1>
            </div>
            <div class="content">
              <p>We've successfully received your payment for order <strong>${order.orderNumber}</strong>.</p>
              <p><strong>Amount Paid:</strong> KES ${Number(order.total).toFixed(2)}</p>
              <p>Your order is now being processed. We'll notify you when it ships.</p>
              <p>Thank you for your purchase!</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Kaksingri Denim. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: customerEmail,
      subject: `Payment Confirmation - ${order.orderNumber}`,
      html,
    });
  }

  async getEmailPreferences(): Promise<Record<string, boolean>> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key: 'email_notification_preferences' },
      });

      if (setting && setting.value) {
        return setting.value as Record<string, boolean>;
      }

      // Default preferences - all enabled
      return {
        orderConfirmation: true,
        shippingUpdate: true,
        paymentConfirmation: true,
        passwordReset: true,
        lowStockAlert: true,
      };
    } catch (error) {
      console.error('Error getting email preferences:', error);
      return {
        orderConfirmation: true,
        shippingUpdate: true,
        paymentConfirmation: true,
        passwordReset: true,
        lowStockAlert: true,
      };
    }
  }

  async updateEmailPreferences(preferences: Record<string, boolean>): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key: 'email_notification_preferences' },
      update: {
        value: preferences as any,
        category: 'email',
      },
      create: {
        key: 'email_notification_preferences',
        value: preferences as any,
        category: 'email',
      },
    });
  }

  async isEmailTypeEnabled(type: string): Promise<boolean> {
    const preferences = await this.getEmailPreferences();
    return preferences[type] !== false; // Default to true if not set
  }

  async sendLowStockAlert(product: any, currentStock: number, threshold: number): Promise<boolean> {
    // Check if low stock alerts are enabled
    if (!(await this.isEmailTypeEnabled('lowStockAlert'))) {
      return false;
    }
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #F59E0B; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Low Stock Alert</h1>
            </div>
            <div class="content">
              <p><strong>Product:</strong> ${product.name}</p>
              <p><strong>SKU:</strong> ${product.sku || 'N/A'}</p>
              <p><strong>Current Stock:</strong> ${currentStock} units</p>
              <p><strong>Threshold:</strong> ${threshold} units</p>
              <p>Please consider restocking this product soon.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Kaksingri Denim. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Get admin emails from settings or use default
    const adminEmails = await this.getAdminEmails();
    
    if (adminEmails.length === 0) {
      console.warn('No admin emails configured for low stock alerts');
      return false;
    }

    return this.sendEmail({
      to: adminEmails,
      subject: `Low Stock Alert - ${product.name}`,
      html,
    });
  }

  private async getAdminEmails(): Promise<string[]> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key: 'admin_emails' },
      });

      if (setting && setting.value) {
        const emails = setting.value as any;
        return Array.isArray(emails) ? emails : [emails];
      }

      // Fallback: get emails from admin users
      const admins = await this.prisma.user.findMany({
        where: {
          role: { in: ['SUPER_ADMIN', 'ADMIN'] },
          isActive: true,
        },
        select: { email: true },
      });

      return admins.map((admin) => admin.email).filter(Boolean);
    } catch (error) {
      console.error('Error getting admin emails:', error);
      return [];
    }
  }
}

