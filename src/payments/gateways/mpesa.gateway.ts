import { Injectable, BadRequestException } from '@nestjs/common';
import { IPaymentGateway, PaymentRequest, PaymentResponse, PaymentStatus } from '../interfaces/payment-gateway.interface';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class MpesaGateway implements IPaymentGateway {
  private consumerKey: string;
  private consumerSecret: string;
  private shortcode: string;
  private passkey: string;
  private environment: 'sandbox' | 'production';
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(credentials: Record<string, any>) {
    this.consumerKey = credentials.consumerKey;
    this.consumerSecret = credentials.consumerSecret;
    this.shortcode = credentials.shortcode;
    this.passkey = credentials.passkey;
    this.environment = credentials.environment || 'sandbox';
    this.baseUrl =
      this.environment === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';
  }

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      const response = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      this.accessToken = response.data.access_token;
      // Set expiry to 55 minutes (tokens expire in 1 hour)
      this.tokenExpiry = new Date(Date.now() + 55 * 60 * 1000);
      return this.accessToken;
    } catch (error: any) {
      const errorMsg = error.response?.data?.errorMessage || error.message;
      console.error('[MpesaGateway] Access token error:', errorMsg);
      throw new BadRequestException(`Failed to get M-Pesa access token. Check your Consumer Key and Consumer Secret. Error: ${errorMsg}`);
    }
  }

  private generatePassword(): string {
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');
    return password;
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    if (!request.customerPhone) {
      throw new BadRequestException('Customer phone number is required for M-Pesa payment');
    }

    try {
      const accessToken = await this.getAccessToken();
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
      const password = this.generatePassword();

      // Format phone number (remove + and ensure it starts with 254)
      let phone = request.customerPhone.replace(/\+/g, '').replace(/\s/g, '');
      if (phone.startsWith('0')) {
        phone = '254' + phone.substring(1);
      } else if (!phone.startsWith('254')) {
        phone = '254' + phone;
      }

      // Get callback URL - must be publicly accessible
      const appUrl = process.env.APP_URL || 'http://localhost:3001';
      const callbackUrl = `${appUrl}/api/payments/webhooks/mpesa`;
      
      // Validate callback URL format
      if (this.environment === 'production' && !callbackUrl.startsWith('https://')) {
        throw new BadRequestException('Production callback URL must use HTTPS. Please set APP_URL environment variable to your production domain.');
      }

      console.log(`[MpesaGateway] Using callback URL: ${callbackUrl}`);

      const stkPushPayload = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(request.amount), // M-Pesa requires integer amount
        PartyA: phone,
        PartyB: this.shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: request.orderNumber,
        TransactionDesc: request.description || `Payment for order ${request.orderNumber}`,
      };

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        stkPushPayload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data.ResponseCode === '0') {
        return {
          success: true,
          transactionId: response.data.CheckoutRequestID,
          paymentReference: response.data.CheckoutRequestID,
          message: 'STK push sent successfully. Please check your phone to complete payment.',
          requiresAction: true,
          actionType: 'stk_push',
        };
      } else {
        const errorMsg = response.data.ResponseDescription || 'Failed to initiate M-Pesa payment';
        console.error('[MpesaGateway] M-Pesa API error:', errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }
    } catch (error: any) {
      console.error('[MpesaGateway] Payment initiation error:', error);
      const errorMessage = error.response?.data?.errorMessage || 
                          error.response?.data?.ResponseDescription ||
                          error.message || 
                          'Failed to initiate M-Pesa payment';
      
      // Provide helpful error messages
      if (errorMessage.includes('CallBackURL') || errorMessage.includes('callback') || errorMessage.includes('Invalid')) {
        return {
          success: false,
          error: `Invalid callback URL. For local testing, use ngrok to expose your server. Set APP_URL environment variable to your public URL (e.g., https://your-ngrok-url.ngrok.io). Error: ${errorMessage}`,
        };
      }
      
      if (errorMessage.includes('Wrong credentials') || errorMessage.includes('credentials') || errorMessage.includes('401') || errorMessage.includes('403')) {
        return {
          success: false,
          error: `M-Pesa authentication failed. Please check your credentials in the payment method settings: Consumer Key, Consumer Secret, Shortcode, and Passkey. Error: ${errorMessage}`,
        };
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async checkPaymentStatus(transactionId: string): Promise<PaymentStatus> {
    try {
      const accessToken = await this.getAccessToken();
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
      const password = this.generatePassword();

      const queryPayload = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: transactionId,
      };

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
        queryPayload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const resultCode = response.data.ResultCode;
      let status: PaymentStatus['status'] = 'pending';

      if (resultCode === '0') {
        status = 'completed';
      } else if (resultCode === '1032' || resultCode === '1037') {
        status = 'cancelled';
      } else {
        status = 'failed';
      }

      return {
        transactionId,
        status,
        amount: parseFloat(response.data.Amount || '0'),
        currency: 'KES',
        paidAt: status === 'completed' ? new Date() : undefined,
        failureReason: status === 'failed' ? response.data.ResultDesc : undefined,
        metadata: response.data,
      };
    } catch (error: any) {
      return {
        transactionId,
        status: 'failed',
        amount: 0,
        currency: 'KES',
        failureReason: error.message || 'Failed to check payment status',
      };
    }
  }

  verifyWebhook(payload: any, signature: string): boolean {
    // M-Pesa doesn't use signature verification in the same way as Stripe
    // Instead, we verify the payload structure and validate the data
    return payload && payload.Body && payload.Body.stkCallback;
  }

  async processWebhook(payload: any): Promise<PaymentStatus> {
    const callback = payload.Body?.stkCallback;
    if (!callback) {
      throw new BadRequestException('Invalid M-Pesa webhook payload');
    }

    const resultCode = callback.ResultCode;
    const checkoutRequestId = callback.CheckoutRequestID;
    const callbackMetadata = callback.CallbackMetadata?.Item || [];

    let status: PaymentStatus['status'] = 'pending';
    let amount = 0;
    let receiptNumber: string | undefined;

    if (resultCode === '0') {
      status = 'completed';
      // Extract amount and receipt number from metadata
      callbackMetadata.forEach((item: any) => {
        if (item.Name === 'Amount') {
          amount = parseFloat(item.Value || '0');
        }
        if (item.Name === 'MpesaReceiptNumber') {
          receiptNumber = item.Value;
        }
      });
    } else if (resultCode === '1032' || resultCode === '1037') {
      status = 'cancelled';
    } else {
      status = 'failed';
    }

    return {
      transactionId: checkoutRequestId,
      status,
      amount,
      currency: 'KES',
      paidAt: status === 'completed' ? new Date() : undefined,
      failureReason: status === 'failed' ? callback.ResultDesc : undefined,
      metadata: {
        receiptNumber,
        ...payload,
      },
    };
  }

  async refund(transactionId: string, amount?: number, reason?: string): Promise<{ success: boolean; refundId?: string; message?: string }> {
    // M-Pesa refunds require reversal API
    // This is a simplified implementation
    return {
      success: false,
      message: 'M-Pesa refunds must be processed manually through the M-Pesa portal',
    };
  }
}

