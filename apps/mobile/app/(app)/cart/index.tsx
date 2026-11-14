import { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { EmptyState } from "../../../src/components/EmptyState";
import { useCartStore } from "../../../src/stores/cart-store";
import { useAuthStore } from "../../../src/stores/auth-store";
import { apiRequest } from "../../../src/lib/api-client";
import { formatCurrency } from "../../../src/lib/format";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { colors, radii, spacing, typography } from "../../../src/theme/tokens";

export default function CartScreen() {
  const theme = useTheme();
  const { user, activeOrganizationId } = useAuthStore();
  const {
    items,
    removeItem,
    clearCart,
    paymentSchedule,
    setPaymentSchedule,
    couponCode,
    applyCoupon,
    removeCoupon,
    customerDetails,
    setCustomerDetails,
    getSubtotal,
    getDiscountAmount,
    getTaxAmount,
    getTotalAmount,
    getAmountPayableNow,
  } = useCartStore();

  const [inputCoupon, setInputCoupon] = useState("");
  const [couponFeedback, setCouponFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-populate customer details from user profile if empty
  useEffect(() => {
    if (user && !customerDetails.fullName) {
      const activeOrg = user.organizations?.find((o) => o.id === activeOrganizationId);
      setCustomerDetails({
        fullName: user.fullName,
        email: user.email,
        businessName: activeOrg?.name ?? "",
      });
    }
  }, [user, activeOrganizationId]);

  if (items.length === 0) {
    return (
      <ScreenContainer>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={[typography.h3, { color: theme.textPrimary }]}>Shopping Cart</Text>
          <View style={{ width: 24 }} />
        </View>
        <EmptyState
          title="Your cart is empty"
          description="Browse our catalogue to choose a high-performance website, mobile app, custom software or automation solution."
          actionLabel="Explore Services"
          onAction={() => router.push("/(app)/services" as Parameters<typeof router.push>[0])}
        />
      </ScreenContainer>
    );
  }

  const item = items[0];
  const subtotal = getSubtotal();
  const discount = getDiscountAmount();
  const tax = getTaxAmount();
  const total = getTotalAmount();
  const payableNow = getAmountPayableNow();

  const handleApplyCoupon = () => {
    if (!inputCoupon.trim()) return;
    const res = applyCoupon(inputCoupon);
    setCouponFeedback(res);
    if (res.success) setInputCoupon("");
  };

  const handleProceedToCheckout = async () => {
    if (!activeOrganizationId) {
      Alert.alert("Organization Required", "Please sign in with an approved organization to complete purchases.");
      return;
    }

    if (!customerDetails.phone.trim()) {
      Alert.alert("Contact Details Required", "Please provide a contact phone number for project onboarding.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Backend package purchase creates: Quote + Audit Acceptance + Project + Milestones + Invoice
      const response = await apiRequest<{
        id: string;
        invoiceNumber: string;
        projectId?: string;
        totalAmount: string;
      }>(`/api/v1/organizations/${activeOrganizationId}/packages/${item.packageId}/purchase`, {
        method: "POST",
        body: {
          paymentSchedule,
          discountCode: couponCode ?? undefined,
          customerDetails: {
            businessName: customerDetails.businessName,
            phone: customerDetails.phone,
            address: customerDetails.billingAddress,
            gstin: customerDetails.gstin,
          },
        },
      });

      // Clear the cart on successful order generation
      clearCart();

      // Route directly into the invoice payment screen with verified Razorpay gateway
      Alert.alert(
        "Order Confirmed!",
        `Invoice #${response.invoiceNumber} and your dedicated Project Workspace have been initialized. Proceed to complete payment.`,
        [
          {
            text: "Proceed to Payment",
            onPress: () =>
              router.push(`/(app)/invoices/${response.id}` as Parameters<typeof router.push>[0]),
          },
        ],
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to place order. Please try again.";
      Alert.alert("Order Failed", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={[typography.h3, { color: theme.textPrimary }]}>Cart & Checkout</Text>
        <Pressable onPress={() => clearCart()} hitSlop={8}>
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Selected Service Package Card */}
        <Card style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <View style={{ flex: 1 }}>
              <View style={[styles.categoryBadge, { backgroundColor: colors.violet50 }]}>
                <Text style={styles.categoryBadgeText}>{item.categoryName}</Text>
              </View>
              <Text style={[typography.h3, { color: theme.textPrimary, marginTop: 4 }]}>
                {item.serviceName}
              </Text>
              <Text style={[typography.bodyStrong, { color: theme.primary, marginTop: 2 }]}>
                {item.packageName}
              </Text>
            </View>
            <Pressable onPress={() => removeItem(item.packageId)} hitSlop={8}>
              <Ionicons name="close-circle-outline" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <Text style={[typography.caption, { color: theme.textSecondary, marginTop: spacing.sm }]}>
            {item.packageDescription}
          </Text>

          <View style={styles.featuresPreview}>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={16} color={theme.primary} />
              <Text style={[typography.small, { color: theme.textPrimary, fontWeight: "600" }]}>
                Estimated Timeline: {item.durationDays} Days
              </Text>
            </View>
            {item.features.slice(0, 4).map((feat, idx) => (
              <View key={idx} style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={[typography.caption, { color: theme.textPrimary, flex: 1 }]}>{feat}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Payment Terms & Schedule Selection */}
        <Text style={[typography.bodyStrong, { color: theme.textPrimary, marginTop: spacing.lg, marginBottom: spacing.xs }]}>
          Payment Schedule
        </Text>
        <Text style={[typography.caption, { color: theme.textSecondary, marginBottom: spacing.sm }]}>
          Choose the payment plan configured for this service:
        </Text>

        <View style={styles.scheduleRow}>
          <Pressable
            style={[
              styles.scheduleOption,
              paymentSchedule === "FULL" && { borderColor: theme.primary, backgroundColor: colors.violet50 },
            ]}
            onPress={() => setPaymentSchedule("FULL")}
          >
            <View style={styles.radioRow}>
              <Ionicons
                name={paymentSchedule === "FULL" ? "radio-button-on" : "radio-button-off"}
                size={18}
                color={paymentSchedule === "FULL" ? theme.primary : theme.textSecondary}
              />
              <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>Full Payment (100%)</Text>
            </View>
            <Text style={[typography.small, { color: theme.textSecondary, marginTop: 4 }]}>
              Pay complete amount upfront. Immediate project kickoff.
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.scheduleOption,
              paymentSchedule === "ADVANCE_50" && { borderColor: theme.primary, backgroundColor: colors.violet50 },
            ]}
            onPress={() => setPaymentSchedule("ADVANCE_50")}
          >
            <View style={styles.radioRow}>
              <Ionicons
                name={paymentSchedule === "ADVANCE_50" ? "radio-button-on" : "radio-button-off"}
                size={18}
                color={paymentSchedule === "ADVANCE_50" ? theme.primary : theme.textSecondary}
              />
              <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>50% Advance + 50% Handover</Text>
            </View>
            <Text style={[typography.small, { color: theme.textSecondary, marginTop: 4 }]}>
              Pay 50% now to begin development; pay remaining 50% upon deliverable approval.
            </Text>
          </Pressable>
        </View>

        {/* Promo / Coupon Code */}
        <Card style={[styles.couponCard, { marginTop: spacing.lg }]}>
          <Text style={[typography.caption, { color: theme.textSecondary, fontWeight: "600" }]}>
            HAVE A PROMO CODE?
          </Text>
          {couponCode ? (
            <View style={styles.activeCouponRow}>
              <View style={styles.activeCouponBadge}>
                <Ionicons name="pricetag" size={16} color={colors.success} />
                <Text style={styles.activeCouponText}>{couponCode} Applied</Text>
              </View>
              <Pressable onPress={() => removeCoupon()} hitSlop={8}>
                <Text style={styles.removeCouponText}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.couponInputRow}>
              <TextInput
                style={[styles.couponInput, { borderColor: theme.border, color: theme.textPrimary }]}
                placeholder="Enter coupon (e.g. KRYPTON10)"
                placeholderTextColor={theme.textSecondary}
                value={inputCoupon}
                onChangeText={setInputCoupon}
                autoCapitalize="characters"
              />
              <Button label="Apply" size="sm" onPress={handleApplyCoupon} />
            </View>
          )}
          {couponFeedback && !couponCode && (
            <Text style={[typography.small, { color: colors.danger, marginTop: 4 }]}>
              {couponFeedback.message}
            </Text>
          )}
        </Card>

        {/* Billing & Business Details Form */}
        <Text style={[typography.bodyStrong, { color: theme.textPrimary, marginTop: spacing.lg, marginBottom: spacing.xs }]}>
          Business & Invoicing Information
        </Text>
        <Card style={styles.billingCard}>
          <View style={styles.inputGroup}>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>Full Name</Text>
            <TextInput
              style={[styles.formInput, { borderColor: theme.border, color: theme.textPrimary }]}
              value={customerDetails.fullName}
              onChangeText={(text) => setCustomerDetails({ fullName: text })}
              placeholder="Your contact name"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>Company / Business Name</Text>
            <TextInput
              style={[styles.formInput, { borderColor: theme.border, color: theme.textPrimary }]}
              value={customerDetails.businessName}
              onChangeText={(text) => setCustomerDetails({ businessName: text })}
              placeholder="Registered enterprise name"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>Contact Phone Number *</Text>
            <TextInput
              style={[styles.formInput, { borderColor: theme.border, color: theme.textPrimary }]}
              value={customerDetails.phone}
              onChangeText={(text) => setCustomerDetails({ phone: text })}
              placeholder="+91 98765 43210"
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>Billing Address</Text>
            <TextInput
              style={[styles.formInput, { borderColor: theme.border, color: theme.textPrimary }]}
              value={customerDetails.billingAddress}
              onChangeText={(text) => setCustomerDetails({ billingAddress: text })}
              placeholder="Street, City, State, PIN"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>GSTIN (Optional, for Input Tax Credit)</Text>
            <TextInput
              style={[styles.formInput, { borderColor: theme.border, color: theme.textPrimary }]}
              value={customerDetails.gstin}
              onChangeText={(text) => setCustomerDetails({ gstin: text.toUpperCase() })}
              placeholder="36AAAAA0000A1Z5"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="characters"
            />
          </View>
        </Card>

        {/* Bill Summary */}
        <Text style={[typography.bodyStrong, { color: theme.textPrimary, marginTop: spacing.lg, marginBottom: spacing.xs }]}>
          Order Breakdown
        </Text>
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={[typography.body, { color: theme.textSecondary }]}>Service Package</Text>
            <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{formatCurrency(subtotal)}</Text>
          </View>

          {discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[typography.body, { color: colors.success }]}>Discount ({couponCode})</Text>
              <Text style={[typography.bodyStrong, { color: colors.success }]}>-{formatCurrency(discount)}</Text>
            </View>
          )}

          <View style={styles.summaryRow}>
            <Text style={[typography.body, { color: theme.textSecondary }]}>Applicable GST (18%)</Text>
            <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{formatCurrency(tax)}</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.summaryRow}>
            <Text style={[typography.h3, { color: theme.textPrimary }]}>Total Value</Text>
            <Text style={[typography.h3, { color: theme.textPrimary }]}>{formatCurrency(total)}</Text>
          </View>

          {paymentSchedule === "ADVANCE_50" && (
            <View style={[styles.advanceHighlight, { backgroundColor: colors.violet50 }]}>
              <View style={styles.summaryRow}>
                <View>
                  <Text style={[typography.bodyStrong, { color: theme.primary }]}>Payable Now (50% Advance)</Text>
                  <Text style={[typography.small, { color: theme.textSecondary }]}>Remaining 50% due on delivery</Text>
                </View>
                <Text style={[typography.h3, { color: theme.primary }]}>{formatCurrency(payableNow)}</Text>
              </View>
            </View>
          )}
        </Card>

        {/* Security & Guarantee Note */}
        <View style={styles.guaranteeBox}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
          <Text style={[typography.small, { color: theme.textSecondary, flex: 1 }]}>
            Protected by KryptonIX Milestone Guarantee. Every project includes dedicated workspace, source code rights, and official tax invoice.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky Bottom Checkout Action */}
      <View style={[styles.footerBar, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <View>
          <Text style={[typography.small, { color: theme.textSecondary }]}>
            {paymentSchedule === "ADVANCE_50" ? "50% Advance" : "Total Payable"}
          </Text>
          <Text style={[typography.h2, { color: theme.primary }]}>{formatCurrency(payableNow)}</Text>
        </View>
        <Button
          label={isSubmitting ? "Generating Order..." : "Confirm & Pay"}
          onPress={handleProceedToCheckout}
          disabled={isSubmitting}
          style={{ minWidth: 170 }}
        />
      </View>
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
  itemCard: {
    padding: spacing.md,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  categoryBadgeText: {
    ...typography.small,
    color: colors.violet700,
    fontWeight: "700",
  },
  featuresPreview: {
    marginTop: spacing.md,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral200,
    paddingTop: spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scheduleRow: {
    gap: spacing.sm,
  },
  scheduleOption: {
    borderWidth: 1.5,
    borderColor: colors.neutral200,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.neutral0,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  couponCard: {
    padding: spacing.md,
  },
  couponInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  activeCouponRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  activeCouponBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activeCouponText: {
    ...typography.bodyStrong,
    color: colors.success,
  },
  removeCouponText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: "600",
  },
  billingCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  inputGroup: {
    gap: 4,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 14,
  },
  summaryCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  advanceHighlight: {
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginTop: 4,
  },
  guaranteeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  footerBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
