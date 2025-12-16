export interface PaymentRequest {
  amount: number;
  currency: string;
  orderId: string;
  orderNumber: string;
  customerPhone?: string;
  customerEmail?: string;
  customerName: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  paymentReference?: string;
  redirectUrl?: string;
  message?: string;
  error?: string;
  requiresAction?: boolean;
  actionType?: 'redirect' | 'otp' | 'stk_push';
}

export interface PaymentStatus {
  transactionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  paidAt?: Date;
  failureReason?: string;
  metadata?: Record<string, any>;
}

export interface IPaymentGateway {
  /**
   * Initiate a payment request
   */
  initiatePayment(request: PaymentRequest): Promise<PaymentResponse>;

  /**
   * Check payment status
   */
  checkPaymentStatus(transactionId: string): Promise<PaymentStatus>;

  /**
   * Verify webhook signature
   */
  verifyWebhook(payload: any, signature: string): boolean;

  /**
   * Process webhook callback
   */
  processWebhook(payload: any): Promise<PaymentStatus>;

  /**
   * Refund a payment
   */
  refund(transactionId: string, amount?: number, reason?: string): Promise<{ success: boolean; refundId?: string; message?: string }>;
}

