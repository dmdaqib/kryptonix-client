import { FlatList, Text, Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { EmptyState } from "../../../src/components/EmptyState";
import { useAuthStore } from "../../../src/stores/auth-store";
import { apiRequest } from "../../../src/lib/api-client";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { spacing, typography } from "../../../src/theme/tokens";

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
  amountPaid: string;
  status: string;
  dueDate: string;
}

const STATUS_COLOR: Record<string, "textSecondary" | "success" | "warning" | "danger"> = {
  PAID: "success",
  PARTIALLY_PAID: "warning",
  SENT: "textSecondary",
  OVERDUE: "danger",
  DRAFT: "textSecondary",
  VOID: "textSecondary",
};

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
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState title="No invoices yet" description="Invoices will appear here once KryptonIX issues one." />
          ) : null
        }
        ItemSeparatorComponent={() => <Text style={{ height: spacing.sm }} />}
        renderItem={({ item }) => {
          const outstanding = Number(item.totalAmount) - Number(item.amountPaid);
          const statusKey = STATUS_COLOR[item.status] ?? "textSecondary";
          return (
            <Pressable onPress={() => router.push(`/(app)/invoices/${item.id}`)}>
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{item.invoiceNumber}</Text>
                  <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                    ₹{Number(item.totalAmount).toLocaleString("en-IN")}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs }}>
                  <Text style={[typography.caption, { color: theme[statusKey] }]}>{item.status}</Text>
                  {outstanding > 0 ? (
                    <Text style={[typography.caption, { color: theme.textSecondary }]}>
                      ₹{outstanding.toLocaleString("en-IN")} due
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
