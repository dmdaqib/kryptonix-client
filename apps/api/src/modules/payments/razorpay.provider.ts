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
  private client: Razorpay;

  constructor() {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new Error(
        "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set. Use Razorpay's test-mode keys in development; never commit real keys.",
      );
    }
    this.client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
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
  }

  verifyCheckoutSignature(params: { orderId: string; paymentId: string; signature: string }) {
    return verifyCheckoutSignature({ ...params, keySecret: env.RAZORPAY_KEY_SECRET! });
  }

  verifyWebhookSignature(params: { rawBody: string; signature: string }) {
    if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
    return verifyWebhookSignature({ ...params, webhookSecret: env.RAZORPAY_WEBHOOK_SECRET });
  }

  async createRefund(input: CreateRefundInput): Promise<CreateRefundResult> {
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
