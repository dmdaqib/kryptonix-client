// Provider-independent payment gateway interface. Every route in this
// module talks to this interface, never to a gateway SDK directly — adding
// a second provider (or switching away from Razorpay later) means writing
// one new file that implements this interface, with zero changes to
// invoices/payments/refunds routes.

export interface CreateOrderInput {
  amount: number; // smallest currency unit (paise for INR)
  currency: string;
  receipt: string; // our own invoice/payment id, for provider-side reconciliation
  notes?: Record<string, string>;
}

export interface CreateOrderResult {
  providerOrderId: string;
  amount: number;
  currency: string;
}

export interface CreateRefundInput {
  providerPaymentId: string;
  amount: number; // smallest currency unit
  notes?: Record<string, string>;
}

export interface CreateRefundResult {
  providerRefundId: string;
  status: string;
}

export interface PaymentProvider {
  name: string;
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  verifyCheckoutSignature(params: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean;
  verifyWebhookSignature(params: { rawBody: string; signature: string }): boolean;
  createRefund(input: CreateRefundInput): Promise<CreateRefundResult>;
}
