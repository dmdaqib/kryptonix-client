import { ScrollView, Text, View, Pressable, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { StatusPill } from "../../src/components/StatusPill";
import { useAuthStore } from "../../src/stores/auth-store";
import { apiRequest } from "../../src/lib/api-client";
import { formatCurrency } from "../../src/lib/format";
import { useTheme } from "../../src/theme/ThemeProvider";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
  amountPaid: string;
  status: string;
  dueDate: string;
}

const QUICK_ACTIONS: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Parameters<typeof router.push>[0];
}[] = [
  { label: "Services", icon: "grid-outline", href: "/(app)/services" },
  { label: "Projects", icon: "briefcase-outline", href: "/(app)/projects" },
  { label: "Invoices", icon: "receipt-outline", href: "/(app)/invoices" },
  { label: "Support", icon: "help-buoy-outline", href: "/(app)/tickets" },
];

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export default function DashboardScreen() {
  const theme = useTheme();
  const { user, activeOrganizationId } = useAuthStore();

  const { data: invoices } = useQuery({
    queryKey: ["invoices", activeOrganizationId],
    queryFn: () => apiRequest<Invoice[]>(`/api/v1/organizations/${activeOrganizationId}/invoices`),
    enabled: Boolean(activeOrganizationId),
  });

  const outstanding = (invoices ?? []).filter((i) => i.status !== "PAID" && i.status !== "VOID");
  const totalOutstanding = outstanding.reduce(
    (sum, i) => sum + (Number(i.totalAmount) - Number(i.amountPaid)),
    0,
  );

  const hasAnyActivity = (invoices?.length ?? 0) > 0;

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>Welcome back</Text>
            <Text style={[typography.h2, { color: theme.textPrimary }]}>
              {user?.fullName?.split(" ")[0] ?? "there"}
            </Text>
          </View>
          <Pressable onPress={() => router.push("/(app)/profile")}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <Text style={[typography.bodyStrong, { color: theme.primaryText }]}>{initials(user?.fullName)}</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.quickActions}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable key={action.label} style={styles.quickAction} onPress={() => router.push(action.href)}>
              <View style={[styles.quickActionIcon, { backgroundColor: colors.violet50 }]}>
                <Ionicons name={action.icon} size={22} color={theme.primary} />
              </View>
              <Text style={[typography.caption, { color: theme.textPrimary, fontWeight: "600" }]}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        {!hasAnyActivity ? (
          <EmptyState
            title="Nothing here yet"
            description="Explore our services or submit a custom requirement to get started."
            actionLabel="Explore Services"
            onAction={() => router.push("/(app)/services")}
          />
        ) : (
          <>
            <Card style={[styles.balanceCard, { marginBottom: spacing.lg }]}>
              <View style={[styles.balanceIcon, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
                <Ionicons name="wallet-outline" size={22} color="#fff" />
              </View>
              <Text style={[typography.caption, { color: "rgba(255,255,255,0.85)" }]}>Outstanding balance</Text>
              <Text style={[typography.h1, { color: "#fff" }]}>{formatCurrency(totalOutstanding)}</Text>
              <Text style={[typography.caption, { color: "rgba(255,255,255,0.85)" }]}>
                across {outstanding.length} invoice{outstanding.length === 1 ? "" : "s"}
              </Text>
            </Card>

            <View style={styles.sectionHeader}>
              <Text style={[typography.h3, { color: theme.textPrimary }]}>Recent invoices</Text>
              <Pressable onPress={() => router.push("/(app)/invoices")}>
                <Text style={[typography.caption, { color: theme.primary, fontWeight: "600" }]}>View all</Text>
              </Pressable>
            </View>
            {(invoices ?? []).slice(0, 5).map((invoice) => (
              <Card key={invoice.id} style={{ marginBottom: spacing.sm }}>
                <View style={styles.invoiceRow}>
                  <View style={[styles.invoiceIcon, { backgroundColor: colors.neutral100 }]}>
                    <Ionicons name="document-text-outline" size={18} color={theme.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{invoice.invoiceNumber}</Text>
                    <Text style={[typography.caption, { color: theme.textSecondary }]}>
                      Due {new Date(invoice.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                      {formatCurrency(invoice.totalAmount)}
                    </Text>
                    <StatusPill status={invoice.status} />
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  quickAction: {
    alignItems: "center",
    gap: spacing.xs,
    width: "23%",
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  balanceCard: {
    backgroundColor: colors.violet600,
    borderWidth: 0,
    gap: 4,
  },
  balanceIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  invoiceIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
