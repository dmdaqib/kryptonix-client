import { ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { useAuthStore } from "../../src/stores/auth-store";
import { apiRequest } from "../../src/lib/api-client";
import { useTheme } from "../../src/theme/ThemeProvider";
import { spacing, typography } from "../../src/theme/tokens";

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
  amountPaid: string;
  status: string;
  dueDate: string;
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
        <Text style={[typography.h2, { color: theme.textPrimary }]}>
          Welcome back, {user?.fullName?.split(" ")[0] ?? ""}
        </Text>
        <Text style={[typography.body, { color: theme.textSecondary, marginBottom: spacing.lg }]}>
          Here's what's happening with your account.
        </Text>

        {!hasAnyActivity ? (
          <EmptyState
            title="Nothing here yet"
            description="Explore our services or submit a custom requirement to get started."
            actionLabel="Explore Services"
            onAction={() => router.push("/(app)/services")}
          />
        ) : (
          <>
            <Card style={{ marginBottom: spacing.md }}>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>Outstanding balance</Text>
              <Text style={[typography.h1, { color: theme.textPrimary }]}>
                ₹{totalOutstanding.toLocaleString("en-IN")}
              </Text>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>
                across {outstanding.length} invoice{outstanding.length === 1 ? "" : "s"}
              </Text>
            </Card>

            <Text style={[typography.h3, { color: theme.textPrimary, marginBottom: spacing.sm }]}>
              Recent invoices
            </Text>
            {(invoices ?? []).slice(0, 5).map((invoice) => (
              <Card key={invoice.id} style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                    {invoice.invoiceNumber}
                  </Text>
                  <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                    ₹{Number(invoice.totalAmount).toLocaleString("en-IN")}
                  </Text>
                </View>
                <Text style={[typography.caption, { color: theme.textSecondary }]}>{invoice.status}</Text>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
