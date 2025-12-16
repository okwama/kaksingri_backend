import { Injectable, BadRequestException } from '@nestjs/common';
import { IPaymentGateway, PaymentRequest, PaymentResponse, PaymentStatus } from '../interfaces/payment-gateway.interface';
import axios from 'axios';

@Injectable()
export class PayPalGateway implements IPaymentGateway {
  private clientId: string;
  private clientSecret: string;
  private mode: 'sandbox' | 'live';
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(credentials: Record<string, any>) {
    this.clientId = credentials.clientId;
    this.clientSecret = credentials.clientSecret;
    this.mode = credentials.mode || 'sandbox';
    this.baseUrl = this.mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  }

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      const response = await axios.post(
        `${this.baseUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.accessToken = response.data.access_token;
      // Set expiry to 8 hours (PayPal tokens typically last 9 hours)
      this.tokenExpiry = new Date(Date.now() + 8 * 60 * 60 * 1000);
      return this.accessToken;
    } catch (error: any) {
      throw new BadRequestException(`Failed to get PayPal access token: ${error.message}`);
    }
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      const accessToken = await this.getAccessToken();
      const appUrl = process.env.APP_URL || 'http://localhost:3001';

      const orderPayload = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: request.orderNumber,
            description: request.description || `Payment for order ${request.orderNumber}`,
            amount: {
              currency_code: request.currency,
              value: request.amount.toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: 'Kaksingri Denim',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${appUrl}/checkout/paypal/success?orderId=${request.orderId}`,
          cancel_url: `${appUrl}/checkout/paypal/cancel?orderId=${request.orderId}`,
        },
      };

      const response = await axios.post(`${this.baseUrl}/v2/checkout/orders`, orderPayload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const order = response.data;
      const approveLink = order.links?.find((link: any) => link.rel === 'approve');

      return {
        success: true,
        transactionId: order.id,
        paymentReference: order.id,
        redirectUrl: approveLink?.href,
        message: 'PayPal order created successfully',
        requiresAction: true,
        actionType: 'redirect',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to initiate PayPal payment',
      };
    }
  }

  async checkPaymentStatus(transactionId: string): Promise<PaymentStatus> {
    try {
      const accessToken = await this.getAccessToken();
      const response = await axios.get(`${this.baseUrl}/v2/checkout/orders/${transactionId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const order = response.data;
      let status: PaymentStatus['status'] = 'pending';

      if (order.status === 'COMPLETED') {
        status = 'completed';
      } else if (order.status === 'APPROVED') {
        status = 'processing';
      } else if (order.status === 'CANCELLED' || order.status === 'VOIDED') {
        status = 'cancelled';
      } else if (order.status === 'CREATED' || order.status === 'SAVED') {
        status = 'pending';
      } else {
        status = 'failed';
      }

      const purchaseUnit = order.purchase_units?.[0];
      const capture = purchaseUnit?.payments?.captures?.[0];

      return {
        transactionId: order.id,
        status,
        amount: parseFloat(purchaseUnit?.amount?.value || '0'),
        currency: purchaseUnit?.amount?.currency_code || 'USD',
        paidAt: status === 'completed' && capture ? new Date(capture.create_time) : undefined,
        metadata: order,
      };
    } catch (error: any) {
      return {
        transactionId,
        status: 'failed',
        amount: 0,
        currency: 'USD',
        failureReason: error.message || 'Failed to check payment status',
      };
    }
  }

  verifyWebhook(payload: any, signature: string): boolean {
    // PayPal webhook verification requires verifying the signature
    // This is a simplified version - in production, use PayPal's webhook verification SDK
    return payload && payload.event_type && payload.resource;
  }

  async processWebhook(payload: any): Promise<PaymentStatus> {
    const eventType = payload.event_type;
    const resource = payload.resource;

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      return {
        transactionId: resource.supplementary_data?.related_ids?.order_id || resource.id,
        status: 'completed',
        amount: parseFloat(resource.amount?.value || '0'),
        currency: resource.amount?.currency_code || 'USD',
        paidAt: new Date(resource.create_time),
        metadata: payload,
      };
    } else if (eventType === 'PAYMENT.CAPTURE.DENIED' || eventType === 'PAYMENT.CAPTURE.REFUNDED') {
      return {
        transactionId: resource.supplementary_data?.related_ids?.order_id || resource.id,
        status: eventType === 'PAYMENT.CAPTURE.REFUNDED' ? 'cancelled' : 'failed',
        amount: parseFloat(resource.amount?.value || '0'),
        currency: resource.amount?.currency_code || 'USD',
        failureReason: resource.reason_code,
        metadata: payload,
      };
    }

    // For other event types, return pending status
    return {
      transactionId: resource?.id || 'unknown',
      status: 'pending',
      amount: 0,
      currency: 'USD',
      metadata: payload,
    };
  }

  async refund(transactionId: string, amount?: number, reason?: string): Promise<{ success: boolean; refundId?: string; message?: string }> {
    try {
      const accessToken = await this.getAccessToken();

      // First, get the capture ID from the order
      const orderResponse = await axios.get(`${this.baseUrl}/v2/checkout/orders/${transactionId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const purchaseUnit = orderResponse.data.purchase_units?.[0];
      const capture = purchaseUnit?.payments?.captures?.[0];

      if (!capture) {
        return {
          success: false,
          message: 'No capture found for this order',
        };
      }

      const refundPayload: any = {};
      if (amount) {
        refundPayload.amount = {
          value: amount.toFixed(2),
          currency_code: capture.amount.currency_code,
        };
      }
      if (reason) {
        refundPayload.note_to_payer = reason;
      }

      const refundResponse = await axios.post(
        `${this.baseUrl}/v2/payments/captures/${capture.id}/refund`,
        refundPayload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return {
        success: true,
        refundId: refundResponse.data.id,
        message: 'Refund processed successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to process refund',
      };
    }
  }
}

