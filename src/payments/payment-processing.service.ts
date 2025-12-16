import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PaymentMethodsService } from './payment-methods.service';
import { IPaymentGateway, PaymentRequest, PaymentResponse } from './interfaces/payment-gateway.interface';
import { MpesaGateway } from './gateways/mpesa.gateway';
import { StripeGateway } from './gateways/stripe.gateway';
import { PayPalGateway } from './gateways/paypal.gateway';
import { PaymentMethodType, PaymentTransactionStatus } from '@prisma/client';
import { EmailService } from '../notifications/email.service';
import { LoyaltyService } from '../loyalty/loyalty.service';

@Injectable()
export class PaymentProcessingService {
  constructor(
    private prisma: PrismaService,
    private paymentMethodsService: PaymentMethodsService,
    @Inject(forwardRef(() => EmailService))
    private emailService?: EmailService,
    private loyaltyService?: LoyaltyService,
  ) {}

  private createGateway(paymentMethod: any): IPaymentGateway {
    const credentials = paymentMethod.credentials as Record<string, any>;

    switch (paymentMethod.type) {
      case PaymentMethodType.MPESA:
        return new MpesaGateway(credentials);
      case PaymentMethodType.STRIPE:
        return new StripeGateway(credentials);
      case PaymentMethodType.PAYPAL:
        return new PayPalGateway(credentials);
      default:
        throw new BadRequestException(`Payment gateway for type ${paymentMethod.type} is not implemented`);
    }
  }

  async initiatePayment(orderId: string, paymentMethodId?: string, customerPhone?: string, customerEmail?: string): Promise<PaymentResponse> {
    console.log(`[PaymentProcessing] Initiating payment for order ${orderId}, paymentMethodId: ${paymentMethodId}`);
    
    // Get order
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: true,
        paymentMethod: true,
      },
    });

    if (!order) {
      console.error(`[PaymentProcessing] Order ${orderId} not found`);
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    console.log(`[PaymentProcessing] Order found: ${order.orderNumber}, total: ${order.total}`);

    // Get payment method
    let paymentMethod = order.paymentMethod;

    if (!paymentMethod) {
      console.log(`[PaymentProcessing] Order has no payment method, looking up paymentMethodId: ${paymentMethodId}`);
      if (!paymentMethodId) {
        // Get default active payment method
        const methods = await this.paymentMethodsService.getActiveMethods();
        const defaultMethod = methods.find((m) => m.isDefault) || methods[0];

        if (!defaultMethod) {
          console.error('[PaymentProcessing] No active payment method found');
          throw new BadRequestException('No payment method available. Please configure a payment method first.');
        }

        console.log(`[PaymentProcessing] Using default payment method: ${defaultMethod.id}`);
        paymentMethod = await this.prisma.paymentMethod.findUnique({
          where: { id: defaultMethod.id },
        });
      } else {
        paymentMethod = await this.prisma.paymentMethod.findUnique({
          where: { id: paymentMethodId },
        });
      }
    }

    if (!paymentMethod) {
      console.error(`[PaymentProcessing] Payment method not found: ${paymentMethodId}`);
      throw new BadRequestException('Payment method not found');
    }

    if (!paymentMethod.isActive) {
      console.error(`[PaymentProcessing] Payment method is inactive: ${paymentMethod.id}`);
      throw new BadRequestException('Payment method is inactive');
    }

    console.log(`[PaymentProcessing] Using payment method: ${paymentMethod.name} (${paymentMethod.type}), active: ${paymentMethod.isActive}`);

    // Handle cash on delivery - no payment processing needed
    if (paymentMethod.type === PaymentMethodType.CASH_ON_DELIVERY) {
      // Create a transaction record for COD
      await this.prisma.paymentTransaction.create({
        data: {
          orderId: order.id,
          paymentMethodId: paymentMethod.id,
          amount: order.total,
          currency: 'KES',
          status: PaymentTransactionStatus.PENDING,
        },
      });

      return {
        success: true,
        message: 'Order will be paid on delivery',
      };
    }

    // Get decrypted credentials
    console.log(`[PaymentProcessing] Getting credentials for payment method: ${paymentMethod.id}`);
    const paymentMethodWithCredentials = await this.paymentMethodsService.findOne(paymentMethod.id, true);
    console.log(`[PaymentProcessing] Credentials retrieved, type: ${paymentMethodWithCredentials.type}`);
    
    const gateway = this.createGateway(paymentMethodWithCredentials);
    console.log(`[PaymentProcessing] Gateway created successfully`);

    // Prepare payment request
    const paymentRequest: PaymentRequest = {
      amount: Number(order.total),
      currency: 'KES', // Default to KES, can be made configurable
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerPhone: customerPhone || order.client?.phone || undefined,
      customerEmail: customerEmail || order.client?.email || undefined,
      customerName: order.client?.name || 'Customer',
      description: `Payment for order ${order.orderNumber}`,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
    };

    console.log(`[PaymentProcessing] Initiating payment: amount=${paymentRequest.amount}, phone=${paymentRequest.customerPhone}, email=${paymentRequest.customerEmail}`);

    // Initiate payment
    let paymentResponse: PaymentResponse;
    try {
      paymentResponse = await gateway.initiatePayment(paymentRequest);
      console.log(`[PaymentProcessing] Payment initiated: success=${paymentResponse.success}, transactionId=${paymentResponse.transactionId}`);
    } catch (error: any) {
      console.error(`[PaymentProcessing] Gateway error:`, error);
      throw error;
    }

    if (paymentResponse.success && paymentResponse.transactionId) {
      // Create payment transaction record
      await this.prisma.paymentTransaction.create({
        data: {
          orderId: order.id,
          paymentMethodId: paymentMethod.id,
          transactionId: paymentResponse.transactionId,
          amount: order.total,
          currency: paymentRequest.currency,
          status: PaymentTransactionStatus.PENDING,
          gatewayResponse: paymentResponse as any,
        },
      });

      // Update order payment status
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'PENDING',
          paymentMethodId: paymentMethod.id,
        },
      });
    }

    return paymentResponse;
  }

  async checkPaymentStatus(transactionId: string): Promise<any> {
    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { transactionId },
      include: {
        paymentMethod: true,
        order: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Payment transaction with ID ${transactionId} not found`);
    }

    // Get decrypted credentials
    const paymentMethodWithCredentials = await this.paymentMethodsService.findOne(transaction.paymentMethodId, true);
    const gateway = this.createGateway(paymentMethodWithCredentials);

    // Check status from gateway
    const status = await gateway.checkPaymentStatus(transactionId);

    // Update transaction status
    let dbStatus: PaymentTransactionStatus = PaymentTransactionStatus.PENDING;
    if (status.status === 'completed') {
      dbStatus = PaymentTransactionStatus.COMPLETED;
    } else if (status.status === 'processing') {
      dbStatus = PaymentTransactionStatus.PROCESSING;
    } else if (status.status === 'failed') {
      dbStatus = PaymentTransactionStatus.FAILED;
    } else if (status.status === 'cancelled') {
      dbStatus = PaymentTransactionStatus.CANCELLED;
    }

    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: dbStatus,
        paidAt: status.paidAt,
        failureReason: status.failureReason,
        gatewayResponse: status.metadata as any,
      },
    });

    // Update order payment status if completed
    if (status.status === 'completed') {
      const updatedOrder = await this.prisma.order.update({
        where: { id: transaction.orderId },
        data: {
          paymentStatus: 'PAID',
          status: 'CONFIRMED', // Auto-confirm order when payment is completed
        },
        include: {
          client: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Send payment confirmation email (non-blocking)
      if (this.emailService) {
        const customerEmail = updatedOrder.client?.email;
        if (customerEmail) {
          this.emailService.sendPaymentConfirmation(updatedOrder, customerEmail).catch((error) => {
            console.error('Failed to send payment confirmation email:', error);
          });
        }
      }

      // Award loyalty points (non-blocking)
      if (this.loyaltyService && updatedOrder.clientId) {
        this.loyaltyService
          .calculatePointsFromOrder(updatedOrder.id)
          .then((points) => {
            if (points > 0) {
              return this.loyaltyService.earnPoints(
                updatedOrder.clientId!,
                points,
                updatedOrder.id,
                `Points earned from order ${updatedOrder.orderNumber}`,
              );
            }
          })
          .catch((error) => {
            console.error('Failed to award loyalty points:', error);
          });
      }
    } else if (status.status === 'failed') {
      await this.prisma.order.update({
        where: { id: transaction.orderId },
        data: {
          paymentStatus: 'FAILED',
        },
      });
    }

    return status;
  }

  async processWebhook(
    gatewayType: string,
    payload: any,
    signature?: string,
  ): Promise<any> {
    // Find payment method by type
    const paymentMethodType = gatewayType.toUpperCase() as PaymentMethodType;
    const paymentMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        type: paymentMethodType,
        isActive: true,
      },
    });

    if (!paymentMethod) {
      throw new NotFoundException(`Active payment method for ${gatewayType} not found`);
    }

    // Get decrypted credentials
    const paymentMethodWithCredentials = await this.paymentMethodsService.findOne(paymentMethod.id, true);
    const gateway = this.createGateway(paymentMethodWithCredentials);

    // Verify webhook
    if (signature && !gateway.verifyWebhook(payload, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Process webhook
    const paymentStatus = await gateway.processWebhook(payload);

    // Find transaction by gateway transaction ID
    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { transactionId: paymentStatus.transactionId },
      include: { order: true },
    });

    if (!transaction) {
      throw new NotFoundException(`Payment transaction not found for ${paymentStatus.transactionId}`);
    }

    // Update transaction
    let dbStatus: PaymentTransactionStatus = PaymentTransactionStatus.PENDING;
    if (paymentStatus.status === 'completed') {
      dbStatus = PaymentTransactionStatus.COMPLETED;
    } else if (paymentStatus.status === 'processing') {
      dbStatus = PaymentTransactionStatus.PROCESSING;
    } else if (paymentStatus.status === 'failed') {
      dbStatus = PaymentTransactionStatus.FAILED;
    } else if (paymentStatus.status === 'cancelled') {
      dbStatus = PaymentTransactionStatus.CANCELLED;
    }

    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: dbStatus,
        paidAt: paymentStatus.paidAt,
        failureReason: paymentStatus.failureReason,
        gatewayResponse: paymentStatus.metadata as any,
      },
    });

    // Update order payment status
    if (paymentStatus.status === 'completed') {
      const updatedOrder = await this.prisma.order.update({
        where: { id: transaction.orderId },
        data: {
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
        },
        include: {
          client: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Send payment confirmation email (non-blocking)
      if (this.emailService) {
        const customerEmail = updatedOrder.client?.email;
        if (customerEmail) {
          this.emailService.sendPaymentConfirmation(updatedOrder, customerEmail).catch((error) => {
            console.error('Failed to send payment confirmation email:', error);
          });
        }
      }

      // Award loyalty points (non-blocking)
      if (this.loyaltyService && updatedOrder.clientId) {
        this.loyaltyService
          .calculatePointsFromOrder(updatedOrder.id)
          .then((points) => {
            if (points > 0) {
              return this.loyaltyService.earnPoints(
                updatedOrder.clientId!,
                points,
                updatedOrder.id,
                `Points earned from order ${updatedOrder.orderNumber}`,
              );
            }
          })
          .catch((error) => {
            console.error('Failed to award loyalty points:', error);
          });
      }
    } else if (paymentStatus.status === 'failed') {
      await this.prisma.order.update({
        where: { id: transaction.orderId },
        data: {
          paymentStatus: 'FAILED',
        },
      });
    }

    return paymentStatus;
  }

  async refundTransaction(transactionId: string, amount?: number, reason?: string): Promise<any> {
    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { transactionId },
      include: {
        paymentMethod: true,
        order: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Payment transaction with ID ${transactionId} not found`);
    }

    if (transaction.status !== PaymentTransactionStatus.COMPLETED) {
      throw new BadRequestException('Can only refund completed transactions');
    }

    // Get decrypted credentials
    const paymentMethodWithCredentials = await this.paymentMethodsService.findOne(transaction.paymentMethodId, true);
    const gateway = this.createGateway(paymentMethodWithCredentials);

    // Process refund
    const refundResult = await gateway.refund(transactionId, amount, reason);

    if (refundResult.success) {
      // Update transaction status
      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: PaymentTransactionStatus.REFUNDED,
        },
      });

      // Update order status
      await this.prisma.order.update({
        where: { id: transaction.orderId },
        data: {
          paymentStatus: 'REFUNDED',
          status: 'REFUNDED',
        },
      });
    }

    return refundResult;
  }

  async findAll(
    status?: PaymentTransactionStatus,
    orderId?: string,
    paymentMethodId?: string,
    dateFrom?: string,
    dateTo?: string,
    limit?: number,
    offset?: number,
  ) {
    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (orderId) {
      where.orderId = orderId;
    }
    
    if (paymentMethodId) {
      where.paymentMethodId = paymentMethodId;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Add one day to include the entire end date
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        where.createdAt.lte = endDate;
      }
    }

    const [transactions, total] = await Promise.all([
      this.prisma.paymentTransaction.findMany({
        where,
        include: {
          order: {
            include: {
              client: true,
            },
          },
          paymentMethod: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit || 50,
        skip: offset || 0,
      }),
      this.prisma.paymentTransaction.count({ where }),
    ]);

    return {
      data: transactions,
      total,
      limit: limit || 50,
      offset: offset || 0,
    };
  }
}

