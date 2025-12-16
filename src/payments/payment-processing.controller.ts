import { Controller, Post, Get, Body, Param, Headers, UseGuards, Request, RawBodyRequest, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentProcessingService } from './payment-processing.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { PaymentTransactionStatus } from '@prisma/client';

@ApiTags('Payments - Processing')
@Controller('payments')
export class PaymentProcessingController {
  constructor(private readonly paymentProcessingService: PaymentProcessingService) {}

  @Post('initiate')
  @Public()
  @ApiOperation({ summary: 'Initiate payment for an order' })
  async initiatePayment(@Body() initiatePaymentDto: InitiatePaymentDto) {
    return this.paymentProcessingService.initiatePayment(
      initiatePaymentDto.orderId,
      initiatePaymentDto.paymentMethodId,
      initiatePaymentDto.customerPhone,
      initiatePaymentDto.customerEmail,
    );
  }

  @Get('status/:transactionId')
  @Public()
  @ApiOperation({ summary: 'Check payment status' })
  async checkPaymentStatus(@Param('transactionId') transactionId: string) {
    return this.paymentProcessingService.checkPaymentStatus(transactionId);
  }

  @Post('webhooks/mpesa')
  @Public()
  @ApiOperation({ summary: 'M-Pesa webhook callback' })
  async mpesaWebhook(@Body() payload: any) {
    return this.paymentProcessingService.processWebhook('MPESA', payload);
  }

  @Post('webhooks/stripe')
  @Public()
  @ApiOperation({ summary: 'Stripe webhook callback' })
  async stripeWebhook(
    @Body() payload: any,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.paymentProcessingService.processWebhook('STRIPE', payload, signature);
  }

  @Post('webhooks/paypal')
  @Public()
  @ApiOperation({ summary: 'PayPal webhook callback' })
  async paypalWebhook(@Body() payload: any, @Headers('paypal-transmission-id') transmissionId?: string) {
    return this.paymentProcessingService.processWebhook('PAYPAL', payload, transmissionId);
  }

  @Post('refund/:transactionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refund a payment transaction' })
  async refundTransaction(
    @Param('transactionId') transactionId: string,
    @Body() body: { amount?: number; reason?: string },
  ) {
    return this.paymentProcessingService.refundTransaction(transactionId, body.amount, body.reason);
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all payment transactions' })
  async getTransactions(
    @Query('status') status?: PaymentTransactionStatus,
    @Query('orderId') orderId?: string,
    @Query('paymentMethodId') paymentMethodId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.paymentProcessingService.findAll(
      status,
      orderId,
      paymentMethodId,
      dateFrom,
      dateTo,
      limit ? parseInt(limit) : undefined,
      offset ? parseInt(offset) : undefined,
    );
  }
}

