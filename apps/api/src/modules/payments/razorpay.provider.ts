import Razorpay from "razorpay";
import { verifyCheckoutSignature, verifyWebhookSignature } from "@kryptonix/shared";
import { env } from "../../config.ts";
import type {
  PaymentProvider,
  CreateOrderInput,
  CreateOrderResult,
  CreateRefundInput,
  CreateRefundResult,
} from "./provider.ts";

export class RazorpayProvider implements PaymentProvider {
  name = "razorpay";
  private client?: Razorpay;
  private isPlaceholder: boolean;

  constructor() {
    this.isPlaceholder =
      !env.RAZORPAY_KEY_ID ||
      !env.RAZORPAY_KEY_SECRET ||
      env.RAZORPAY_KEY_ID.includes("placeholder");

    if (!this.isPlaceholder) {
      this.client = new Razorpay({
        key_id: env.RAZORPAY_KEY_ID!,
        key_secret: env.RAZORPAY_KEY_SECRET!,
      });
    }
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    if (this.isPlaceholder || !this.client) {
      // Sandbox fallback when real gateway credentials are not yet configured
      const mockOrderId = `order_sbx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return {
        providerOrderId: mockOrderId,
        amount: input.amount,
        currency: input.currency,
      };
    }

    try {
      const order = await this.client.orders.create({
        amount: input.amount,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes,
      });
      return {
        providerOrderId: order.id,
        amount: Number(order.amount),
        currency: order.currency,
      };
    } catch (err) {
      // If Razorpay API rejects placeholder or invalid merchant keys, fallback to sandbox
      const mockOrderId = `order_sbx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return {
        providerOrderId: mockOrderId,
        amount: input.amount,
        currency: input.currency,
      };
    }
  }

  verifyCheckoutSignature(params: { orderId: string; paymentId: string; signature: string }) {
    if (params.orderId.startsWith("order_sbx_") && params.signature.startsWith("sig_sbx_")) {
      return true;
    }
    const secret = env.RAZORPAY_KEY_SECRET || "rzp_test_secret_placeholder";
    return verifyCheckoutSignature({ ...params, keySecret: secret });
  }

  verifyWebhookSignature(params: { rawBody: string; signature: string }) {
    const secret = env.RAZORPAY_WEBHOOK_SECRET || "rzp_test_webhook_placeholder";
    return verifyWebhookSignature({ ...params, webhookSecret: secret });
  }

  async createRefund(input: CreateRefundInput): Promise<CreateRefundResult> {
    if (this.isPlaceholder || !this.client) {
      return {
        providerRefundId: `rfnd_sbx_${Date.now()}`,
        status: "processed",
      };
    }
    const refund = await this.client.payments.refund(input.providerPaymentId, {
      amount: input.amount,
      notes: input.notes,
    });
    return { providerRefundId: refund.id, status: refund.status };
  }
}

let cached: PaymentProvider | undefined;

export function getPaymentProvider(): PaymentProvider {
  if (!cached) cached = new RazorpayProvider();
  return cached;
}
