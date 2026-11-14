import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCartStore } from "../stores/cart-store";
import { formatCurrency } from "../lib/format";
import { colors, radii, spacing, typography } from "../theme/tokens";

export function FloatingCartBar() {
  const { items, getAmountPayableNow, paymentSchedule } = useCartStore();

  if (items.length === 0) return null;

  const item = items[0];
  const payableNow = getAmountPayableNow();

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.pill}
        onPress={() => router.push("/(app)/cart" as Parameters<typeof router.push>[0])}
        android_ripple={{ color: "rgba(255,255,255,0.2)" }}
      >
        <View style={styles.left}>
          <View style={styles.iconBadge}>
            <Ionicons name="cart" size={18} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.packageName}
            </Text>
            <Text style={styles.priceSubtext}>
              {formatCurrency(payableNow)}
              {paymentSchedule === "ADVANCE_50" ? " (50% Advance)" : " (Full)"}
            </Text>
          </View>
        </View>

        <View style={styles.right}>
          <Text style={styles.actionText}>View Cart</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    zIndex: 999,
  },
  pill: {
    backgroundColor: colors.violet700,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: {
    ...typography.caption,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  priceSubtext: {
    ...typography.small,
    color: "rgba(255,255,255,0.85)",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.full,
  },
  actionText: {
    ...typography.caption,
    color: "#FFFFFF",
    fontWeight: "700",
  },
});

