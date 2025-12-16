import { Injectable, BadRequestException } from '@nestjs/common';
import { IPaymentGateway, PaymentRequest, PaymentResponse, PaymentStatus } from '../interfaces/payment-gateway.interface';
import Stripe from 'stripe';

@Injectable()
export class StripeGateway implements IPaymentGateway {
  private stripe: Stripe;
  private publishableKey: string;

  constructor(credentials: Record<string, any>) {
    this.publishableKey = credentials.publishableKey;
    const secretKey = credentials.secretKey;
    
    if (!secretKey) {
      throw new BadRequestException('Stripe secret key is required');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-10-29.clover',
    });
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      // Create Payment Intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(request.amount * 100), // Convert to cents
        currency: request.currency.toLowerCase(),
        metadata: {
          orderId: request.orderId,
          orderNumber: request.orderNumber,
          customerName: request.customerName,
          ...request.metadata,
        },
        description: request.description || `Payment for order ${request.orderNumber}`,
        receipt_email: request.customerEmail,
      });

      return {
        success: true,
        transactionId: paymentIntent.id,
        paymentReference: paymentIntent.client_secret,
        message: 'Payment intent created successfully',
        requiresAction: paymentIntent.status === 'requires_action',
        actionType: paymentIntent.status === 'requires_action' ? 'redirect' : undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to initiate Stripe payment',
      };
    }
  }

  async checkPaymentStatus(transactionId: string): Promise<PaymentStatus> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(transactionId);

      let status: PaymentStatus['status'] = 'pending';
      if (paymentIntent.status === 'succeeded') {
        status = 'completed';
      } else if (paymentIntent.status === 'processing') {
        status = 'processing';
      } else if (paymentIntent.status === 'canceled') {
        status = 'cancelled';
      } else if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'requires_action') {
        status = 'pending';
      } else {
        status = 'failed';
      }

      return {
        transactionId: paymentIntent.id,
        status,
        amount: paymentIntent.amount / 100, // Convert from cents
        currency: paymentIntent.currency.toUpperCase(),
        paidAt: status === 'completed' ? new Date(paymentIntent.created * 1000) : undefined,
        failureReason: paymentIntent.last_payment_error?.message,
        metadata: {
          clientSecret: paymentIntent.client_secret,
          status: paymentIntent.status,
        },
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
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return false;
      }

      this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      return true;
    } catch (error) {
      return false;
    }
  }

  async processWebhook(payload: any): Promise<PaymentStatus> {
    const event = payload;

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      return {
        transactionId: paymentIntent.id,
        status: 'completed',
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        paidAt: new Date(paymentIntent.created * 1000),
        metadata: paymentIntent,
      };
    } else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      return {
        transactionId: paymentIntent.id,
        status: 'failed',
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        failureReason: paymentIntent.last_payment_error?.message,
        metadata: paymentIntent,
      };
    } else if (event.type === 'payment_intent.canceled') {
      const paymentIntent = event.data.object;
      return {
        transactionId: paymentIntent.id,
        status: 'cancelled',
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        metadata: paymentIntent,
      };
    }

    // For other event types, return pending status
    return {
      transactionId: event.data.object?.id || 'unknown',
      status: 'pending',
      amount: 0,
      currency: 'USD',
      metadata: event,
    };
  }

  async refund(transactionId: string, amount?: number, reason?: string): Promise<{ success: boolean; refundId?: string; message?: string }> {
    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: transactionId,
      };

      if (amount) {
        // Get payment intent to check original amount
        const paymentIntent = await this.stripe.paymentIntents.retrieve(transactionId);
        refundParams.amount = Math.round(amount * 100); // Convert to cents
      }

      if (reason) {
        refundParams.reason = reason as Stripe.RefundCreateParams.Reason;
      }

      const refund = await this.stripe.refunds.create(refundParams);

      return {
        success: true,
        refundId: refund.id,
        message: 'Refund processed successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to process refund',
      };
    }
  }
}

