import { useState } from "react";
import { ScrollView, Text, View, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import RazorpayCheckout from "react-native-razorpay";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { StatusPill } from "../../../src/components/StatusPill";
import { apiRequest, ApiError } from "../../../src/lib/api-client";
import { useAuthStore } from "../../../src/stores/auth-store";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { formatCurrency } from "../../../src/lib/format";
import { spacing, typography } from "../../../src/theme/tokens";

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  status: string;
  currency: string;
  subtotalAmount: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  dueDate: string;
  items: {
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    taxPercent: string;
    lineTotal: string;
  }[];
  schedules: { id: string; label: string; amount: string; dueDate: string; status: string }[];
}

interface CreateOrderResponse {
  paymentId: string;
  providerOrderId: string;
  amount: number; // paise
  currency: string;
  keyId: string;
}

export default function InvoiceDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [payingScheduleId, setPayingScheduleId] = useState<string | undefined>();

  const { data: invoice } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => apiRequest<InvoiceDetail>(`/api/v1/invoices/${id}`),
  });

  const payMutation = useMutation({
    mutationFn: async (scheduleId: string | undefined) => {
      setPayingScheduleId(scheduleId);

      // 1. Backend decides the amount and opens a gateway order — the
      //    amount is never sent from this screen.
      const order = await apiRequest<CreateOrderResponse>(`/api/v1/invoices/${id}/pay`, {
        method: "POST",
        body: scheduleId ? { scheduleId } : {},
      });

      // 2. Native Razorpay Checkout handles card/UPI/netbanking/wallet entry
      //    entirely inside Razorpay's own secure UI — this app never
      //    touches card numbers or OTPs.
      const checkoutResult = await RazorpayCheckout.open({
        key: order.keyId,
        order_id: order.providerOrderId,
        amount: order.amount,
        currency: order.currency,
        name: "KryptonIX Digital & AI Solutions",
        description: invoice?.invoiceNumber,
        prefill: { email: user?.email, name: user?.fullName },
        theme: { color: "#7C3AED" },
      });

      // 3. Report the result to the backend, which verifies the signature
      //    server-side. The invoice itself only flips to PAID once
      //    Razorpay's webhook independently confirms the charge.
      await apiRequest(`/api/v1/payments/${order.paymentId}/confirm`, {
        method: "POST",
        body: {
          providerPaymentId: checkoutResult.razorpay_payment_id,
          signature: checkoutResult.razorpay_signature,
        },
      });
    },
    onSuccess: () => {
      Alert.alert(
        "Payment received",
        "We're confirming this with your bank — this invoice will update automatically within a few moments.",
      );
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (err) => {
      // Covers both our own API errors and a user-cancelled Razorpay sheet.
      const message = err instanceof ApiError ? err.message : "Payment was not completed.";
      Alert.alert("Payment not completed", message);
    },
    onSettled: () => setPayingScheduleId(undefined),
  });

  if (!invoice) return null;

  const outstanding = Number(invoice.totalAmount) - Number(invoice.amountPaid);
  const fullyPaid = invoice.status === "PAID";

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Text style={[typography.h2, { color: theme.textPrimary }]}>{invoice.invoiceNumber}</Text>
          <StatusPill status={invoice.status} />
        </View>
        <Text style={[typography.caption, { color: theme.textSecondary, marginBottom: spacing.md }]}>
          Due {new Date(invoice.dueDate).toLocaleDateString()}
        </Text>

        <Text style={[typography.h3, { color: theme.textPrimary, marginBottom: spacing.sm }]}>Bill details</Text>
        <Card style={{ marginBottom: spacing.md }}>
          {invoice.items.map((item) => (
            <View key={item.id} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[typography.body, { color: theme.textPrimary, flex: 1 }]}>{item.description}</Text>
                <Text style={[typography.body, { color: theme.textPrimary }]}>
                  {formatCurrency(item.lineTotal, invoice.currency)}
                </Text>
              </View>
              {Number(item.quantity) !== 1 || Number(item.taxPercent) > 0 ? (
                <Text style={[typography.caption, { color: theme.textSecondary }]}>
                  Qty {Number(item.quantity)} × {formatCurrency(item.unitPrice, invoice.currency)}
                  {Number(item.taxPercent) > 0 ? ` · ${Number(item.taxPercent)}% GST` : ""}
                </Text>
              ) : null}
            </View>
          ))}

          <View style={{ borderTopWidth: 1, borderTopColor: theme.border, marginTop: spacing.xs, paddingTop: spacing.sm, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[typography.body, { color: theme.textSecondary }]}>Subtotal</Text>
              <Text style={[typography.body, { color: theme.textSecondary }]}>
                {formatCurrency(invoice.subtotalAmount, invoice.currency)}
              </Text>
            </View>
            {Number(invoice.discountAmount) > 0 ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[typography.body, { color: theme.textSecondary }]}>Discount</Text>
                <Text style={[typography.body, { color: theme.success }]}>
                  -{formatCurrency(invoice.discountAmount, invoice.currency)}
                </Text>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[typography.body, { color: theme.textSecondary }]}>GST / Tax</Text>
              <Text style={[typography.body, { color: theme.textSecondary }]}>
                {formatCurrency(invoice.taxAmount, invoice.currency)}
              </Text>
            </View>
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: theme.border, marginTop: spacing.sm, paddingTop: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>Total payable</Text>
              <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                {formatCurrency(invoice.totalAmount, invoice.currency)}
              </Text>
            </View>
            {Number(invoice.amountPaid) > 0 ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[typography.caption, { color: theme.textSecondary }]}>Paid so far</Text>
                <Text style={[typography.caption, { color: theme.textSecondary }]}>
                  {formatCurrency(invoice.amountPaid, invoice.currency)}
                </Text>
              </View>
            ) : null}
          </View>
        </Card>

        {invoice.schedules.length > 0 ? (
          <>
            <Text style={[typography.h3, { color: theme.textPrimary, marginBottom: spacing.sm }]}>
              Payment schedule
            </Text>
            {invoice.schedules.map((schedule) => (
              <Card key={schedule.id} style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{schedule.label}</Text>
                    <Text style={[typography.caption, { color: theme.textSecondary }]}>
                      {formatCurrency(schedule.amount, invoice.currency)} · due{" "}
                      {new Date(schedule.dueDate).toLocaleDateString()}
                    </Text>
                  </View>
                  {schedule.status === "PAID" ? (
                    <Text style={{ color: theme.success }}>Paid</Text>
                  ) : (
                    <Button
                      label="Pay"
                      fullWidth={false}
                      loading={payMutation.isPending && payingScheduleId === schedule.id}
                      onPress={() => payMutation.mutate(schedule.id)}
                    />
                  )}
                </View>
              </Card>
            ))}
          </>
        ) : !fullyPaid ? (
          <Button
            label={`Pay ${formatCurrency(outstanding, invoice.currency)}`}
            loading={payMutation.isPending && !payingScheduleId}
            onPress={() => payMutation.mutate(undefined)}
          />
        ) : (
          <Text style={{ color: theme.success, textAlign: "center" }}>This invoice is fully paid ✓</Text>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
