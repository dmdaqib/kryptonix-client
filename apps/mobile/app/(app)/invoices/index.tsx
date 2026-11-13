import { FlatList, Text, Pressable, View, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { EmptyState } from "../../../src/components/EmptyState";
import { StatusPill } from "../../../src/components/StatusPill";
import { useAuthStore } from "../../../src/stores/auth-store";
import { apiRequest } from "../../../src/lib/api-client";
import { formatCurrency } from "../../../src/lib/format";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { colors, radii, spacing, typography } from "../../../src/theme/tokens";

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
  amountPaid: string;
  status: string;
  dueDate: string;
}

export default function InvoicesScreen() {
  const theme = useTheme();
  const { activeOrganizationId } = useAuthStore();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", activeOrganizationId],
    queryFn: () => apiRequest<Invoice[]>(`/api/v1/organizations/${activeOrganizationId}/invoices`),
    enabled: Boolean(activeOrganizationId),
  });

  return (
    <ScreenContainer>
      <Text style={[typography.h2, { color: theme.textPrimary, marginBottom: spacing.md }]}>Payments</Text>
      <FlatList
        data={invoices ?? []}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState title="No invoices yet" description="Invoices will appear here once KryptonIX issues one." />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => {
          const outstanding = Number(item.totalAmount) - Number(item.amountPaid);
          const paid = item.status === "PAID";
          return (
            <Pressable onPress={() => router.push(`/(app)/invoices/${item.id}`)}>
              <Card style={styles.row}>
                <View
                  style={[
                    styles.icon,
                    { backgroundColor: paid ? `${theme.success}1F` : colors.neutral100 },
                  ]}
                >
                  <Ionicons
                    name={paid ? "checkmark-done" : "receipt-outline"}
                    size={20}
                    color={paid ? theme.success : theme.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{item.invoiceNumber}</Text>
                  <Text style={[typography.caption, { color: theme.textSecondary }]}>
                    Due {new Date(item.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                    {formatCurrency(item.totalAmount)}
                  </Text>
                  <StatusPill status={item.status} />
                  {outstanding > 0 ? (
                    <Text style={[typography.small, { color: theme.textSecondary }]}>
                      {formatCurrency(outstanding)} due
                    </Text>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
