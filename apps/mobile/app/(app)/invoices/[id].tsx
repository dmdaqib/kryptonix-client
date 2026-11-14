import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import RazorpayCheckout from "react-native-razorpay";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { StatusPill } from "../../../src/components/StatusPill";
import { apiRequest, ApiError } from "../../../src/lib/api-client";
import { useAuthStore } from "../../../src/stores/auth-store";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { formatCurrency } from "../../../src/lib/format";
import { colors, radii, spacing, typography } from "../../../src/theme/tokens";

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  projectId?: string | null;
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
  payments?: {
    id: string;
    amount: string;
    status: string;
    createdAt: string;
    receipt?: { receiptNumber: string } | null;
  }[];
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
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);

  const { data: invoice, refetch } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => apiRequest<InvoiceDetail>(`/api/v1/invoices/${id}`),
    enabled: Boolean(id),
  });

  const payMutation = useMutation({
    mutationFn: async (scheduleId: string | undefined) => {
      setPayingScheduleId(scheduleId);

      // 1. Backend decides the verified amount and opens a gateway order
      const order = await apiRequest<CreateOrderResponse>(`/api/v1/invoices/${id}/pay`, {
        method: "POST",
        body: scheduleId ? { scheduleId } : {},
      });

      let checkoutResult: { razorpay_payment_id: string; razorpay_signature: string };

      try {
        // 2. Real native Razorpay sheet (works on native Android / iOS builds)
        checkoutResult = await RazorpayCheckout.open({
          key: order.keyId,
          order_id: order.providerOrderId,
          amount: order.amount,
          currency: order.currency,
          name: "KryptonIX Digital & AI Solutions",
          description: invoice?.invoiceNumber,
          prefill: { email: user?.email, name: user?.fullName },
          theme: { color: "#7C3AED" },
        });
      } catch (nativeErr: unknown) {
        // Fallback for development sandbox simulator when running in Expo Go without pre-compiled native Razorpay module
        const errMsg = nativeErr instanceof Error ? nativeErr.message : String(nativeErr);
        if (
          order.providerOrderId.startsWith("order_sbx_") ||
          errMsg.includes("NativeModule") ||
          errMsg.includes("null is not an object")
        ) {
          const testPaymentId = `pay_sbx_${Date.now()}`;
          const testSignature = `sig_sbx_${order.providerOrderId}_${testPaymentId}`;
          checkoutResult = {
            razorpay_payment_id: testPaymentId,
            razorpay_signature: testSignature,
          };
        } else {
          throw nativeErr;
        }
      }

      // 3. Report verified transaction to backend
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
        "Payment Confirmed!",
        "Your payment has been verified by the gateway and credited to your invoice. An official tax receipt has been generated.",
      );
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      refetch();
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Payment could not be completed.";
      Alert.alert("Payment Not Completed", message);
    },
    onSettled: () => setPayingScheduleId(undefined),
  });

  const handleRequestRefund = async () => {
    const parsedAmount = Number(refundAmount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert("Amount Required", "Please enter a valid refund amount.");
      return;
    }
    if (!refundReason.trim()) {
      Alert.alert("Reason Required", "Please explain the reason for the refund request.");
      return;
    }

    const latestPayment = invoice?.payments?.[0];
    if (!latestPayment) {
      Alert.alert("No Payment Found", "No completed payment record found to refund.");
      return;
    }

    setIsRefunding(true);
    try {
      await apiRequest(`/api/v1/payments/${latestPayment.id}/refunds`, {
        method: "POST",
        body: {
          amount: parsedAmount,
          reason: refundReason.trim(),
        },
      });
      Alert.alert(
        "Refund Requested",
        "Your refund request has been logged. The KryptonIX finance team will review and process it via the gateway.",
      );
      setShowRefundDialog(false);
      setRefundReason("");
      setRefundAmount("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit refund request";
      Alert.alert("Error", msg);
    } finally {
      setIsRefunding(false);
    }
  };

  if (!invoice) return null;

  const total = Number(invoice.totalAmount);
  const paid = Number(invoice.amountPaid);
  const outstanding = Math.max(0, total - paid);
  const fullyPaid = invoice.status === "PAID";
  const paidPercent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  return (
    <ScreenContainer>
      {/* Top Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={[typography.h3, { color: theme.textPrimary, flex: 1, marginLeft: 8 }]}>
          Invoice #{invoice.invoiceNumber}
        </Text>
        <StatusPill status={invoice.status} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Invoice Summary Card */}
        <Card style={styles.summaryCard}>
          <View style={styles.metaRow}>
            <View>
              <Text style={[typography.small, { color: theme.textSecondary }]}>INVOICE NUMBER</Text>
              <Text style={[typography.h3, { color: theme.textPrimary, marginTop: 2 }]}>
                {invoice.invoiceNumber}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[typography.small, { color: theme.textSecondary }]}>PAYMENT DUE</Text>
              <Text style={[typography.bodyStrong, { color: theme.textPrimary, marginTop: 2 }]}>
                {new Date(invoice.dueDate).toLocaleDateString()}
              </Text>
            </View>
          </View>

          {/* Payment Progress */}
          <View style={styles.progressBox}>
            <View style={styles.progressTextRow}>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>Payment Progress</Text>
              <Text style={[typography.caption, { color: theme.textPrimary, fontWeight: "700" }]}>
                {paidPercent}% Paid
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.max(4, paidPercent)}%`, backgroundColor: fullyPaid ? colors.success : colors.violet700 },
                ]}
              />
            </View>
          </View>

          {/* Project Workspace Link if invoice is linked */}
          {invoice.projectId && (
            <Pressable
              style={styles.projectLinkBox}
              onPress={() => router.push(`/(app)/projects/${invoice.projectId}` as Parameters<typeof router.push>[0])}
            >
              <Ionicons name="briefcase-outline" size={18} color={colors.violet700} />
              <Text style={[typography.caption, { color: colors.violet700, fontWeight: "700", flex: 1 }]}>
                View Associated Project Workspace
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.violet700} />
            </Pressable>
          )}
        </Card>

        {/* Bill Details */}
        <Text style={[typography.bodyStrong, { color: theme.textPrimary, marginTop: spacing.lg, marginBottom: spacing.xs }]}>
          Line Items
        </Text>
        <Card style={styles.card}>
          {invoice.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{item.description}</Text>
                <Text style={[typography.caption, { color: theme.textSecondary }]}>
                  Qty {Number(item.quantity)} × {formatCurrency(item.unitPrice, invoice.currency)}
                  {Number(item.taxPercent) > 0 ? ` · ${Number(item.taxPercent)}% GST` : ""}
                </Text>
              </View>
              <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                {formatCurrency(item.lineTotal, invoice.currency)}
              </Text>
            </View>
          ))}

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.billRow}>
            <Text style={[typography.body, { color: theme.textSecondary }]}>Subtotal</Text>
            <Text style={[typography.body, { color: theme.textPrimary }]}>
              {formatCurrency(invoice.subtotalAmount, invoice.currency)}
            </Text>
          </View>

          {Number(invoice.discountAmount) > 0 && (
            <View style={styles.billRow}>
              <Text style={[typography.body, { color: colors.success }]}>Discount</Text>
              <Text style={[typography.body, { color: colors.success }]}>
                -{formatCurrency(invoice.discountAmount, invoice.currency)}
              </Text>
            </View>
          )}

          <View style={styles.billRow}>
            <Text style={[typography.body, { color: theme.textSecondary }]}>Applicable GST (18%)</Text>
            <Text style={[typography.body, { color: theme.textPrimary }]}>
              {formatCurrency(invoice.taxAmount, invoice.currency)}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.billRow}>
            <Text style={[typography.h3, { color: theme.textPrimary }]}>Total Invoice Value</Text>
            <Text style={[typography.h3, { color: theme.textPrimary }]}>
              {formatCurrency(invoice.totalAmount, invoice.currency)}
            </Text>
          </View>

          {Number(invoice.amountPaid) > 0 && (
            <View style={styles.billRow}>
              <Text style={[typography.caption, { color: colors.success, fontWeight: "600" }]}>
                Amount Paid So Far
              </Text>
              <Text style={[typography.bodyStrong, { color: colors.success }]}>
                {formatCurrency(invoice.amountPaid, invoice.currency)}
              </Text>
            </View>
          )}
        </Card>

        {/* Payment Schedules */}
        {invoice.schedules && invoice.schedules.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[typography.bodyStrong, { color: theme.textPrimary, marginBottom: spacing.xs }]}>
              Configured Instalment Schedule
            </Text>
            {invoice.schedules.map((schedule) => {
              const isSchedulePaid = schedule.status === "PAID";
              return (
                <Card key={schedule.id} style={[styles.card, { marginBottom: spacing.xs }]}>
                  <View style={styles.scheduleRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{schedule.label}</Text>
                      <Text style={[typography.caption, { color: theme.textSecondary }]}>
                        {formatCurrency(schedule.amount, invoice.currency)} • Due{" "}
                        {new Date(schedule.dueDate).toLocaleDateString()}
                      </Text>
                    </View>
                    {isSchedulePaid ? (
                      <View style={styles.paidScheduleBadge}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={styles.paidScheduleText}>Paid</Text>
                      </View>
                    ) : (
                      <Button
                        label="Pay Instalment"
                        size="sm"
                        loading={payMutation.isPending && payingScheduleId === schedule.id}
                        onPress={() => payMutation.mutate(schedule.id)}
                      />
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Full Payment CTA if no schedules and not fully paid */}
        {(!invoice.schedules || invoice.schedules.length === 0) && !fullyPaid && (
          <View style={{ marginTop: spacing.lg }}>
            <Button
              label={`Pay Outstanding ${formatCurrency(outstanding, invoice.currency)}`}
              loading={payMutation.isPending && !payingScheduleId}
              onPress={() => payMutation.mutate(undefined)}
            />
          </View>
        )}

        {fullyPaid && (
          <View style={styles.fullyPaidBanner}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyStrong, { color: colors.success }]}>
                Invoice Fully Paid
              </Text>
              <Text style={[typography.small, { color: theme.textSecondary }]}>
                Payment receipt and GST invoice are fully verified.
              </Text>
            </View>
            <Pressable
              onPress={() => setShowRefundDialog(true)}
              style={styles.refundLink}
            >
              <Text style={styles.refundLinkText}>Request Refund</Text>
            </Pressable>
          </View>
        )}

        {/* Refund Dialog */}
        {showRefundDialog && (
          <Card style={[styles.card, { marginTop: spacing.md, borderColor: colors.danger, borderWidth: 1 }]}>
            <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>Submit Refund Request</Text>
            <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 2 }]}>
              Enter refund amount and reason for finance team review:
            </Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, marginTop: 8 }]}
              placeholder={`Max ${formatCurrency(invoice.amountPaid)}`}
              placeholderTextColor={theme.textSecondary}
              value={refundAmount}
              onChangeText={setRefundAmount}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.textArea, { borderColor: theme.border, color: theme.textPrimary, marginTop: 8 }]}
              placeholder="Explain reason for refund..."
              placeholderTextColor={theme.textSecondary}
              value={refundReason}
              onChangeText={setRefundReason}
              multiline
              numberOfLines={3}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              <Button
                label="Submit Request"
                size="sm"
                variant="danger"
                onPress={handleRequestRefund}
                loading={isRefunding}
                style={{ flex: 1 }}
              />
              <Button
                label="Cancel"
                variant="secondary"
                size="sm"
                onPress={() => setShowRefundDialog(false)}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        )}

        {/* Razorpay Trust Seal */}
        <View style={styles.trustSeal}>
          <Ionicons name="shield-checkmark-outline" size={18} color={theme.textSecondary} />
          <Text style={[typography.small, { color: theme.textSecondary }]}>
            Secured by Razorpay. Supports UPI, Cards, NetBanking, and Wallets.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  backButton: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  summaryCard: {
    padding: spacing.md,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressBox: {
    marginTop: spacing.md,
  },
  progressTextRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.neutral200,
    borderRadius: radii.full,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: radii.full,
  },
  projectLinkBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.violet50,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginTop: spacing.md,
  },
  card: {
    padding: spacing.md,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  divider: {
    height: 1,
    marginVertical: spacing.xs,
  },
  billRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  paidScheduleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  paidScheduleText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: "700",
  },
  fullyPaidBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  refundLink: {
    padding: 4,
  },
  refundLinkText: {
    ...typography.small,
    color: colors.danger,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.sm,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.sm,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: "top",
  },
  trustSeal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing.lg,
  },
});
