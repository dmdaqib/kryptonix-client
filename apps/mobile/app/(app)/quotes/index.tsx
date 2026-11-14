import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
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

interface QuoteSummary {
  id: string;
  quoteNumber: string;
  status: string;
  scopeOfWork: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
  validUntil?: string;
  items: { description: string; quantity: number; unitPrice: string; lineTotal: string }[];
}

export default function QuotesListScreen() {
  const theme = useTheme();
  const { activeOrganizationId } = useAuthStore();

  const { data: quotes, isLoading, refetch } = useQuery({
    queryKey: ["quotes", activeOrganizationId],
    queryFn: () => apiRequest<QuoteSummary[]>(`/api/v1/organizations/${activeOrganizationId}/quotes`),
    enabled: Boolean(activeOrganizationId),
  });

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={[typography.h3, { color: theme.textPrimary }]}>Quotations & Proposals</Text>
        <Pressable onPress={() => router.push("/(app)/enquiry/new" as Parameters<typeof router.push>[0])} hitSlop={8}>
          <Ionicons name="add-circle" size={26} color={theme.primary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {isLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : !quotes || quotes.length === 0 ? (
          <EmptyState
            title="No proposals yet"
            description="When you submit custom requirements or request an enterprise scope, KryptonIX proposals will appear here for your review and approval."
            actionLabel="Request Custom Quotation"
            onAction={() => router.push("/(app)/enquiry/new" as Parameters<typeof router.push>[0])}
          />
        ) : (
          <View style={styles.list}>
            {quotes.map((quote) => (
              <Pressable
                key={quote.id}
                onPress={() => router.push(`/(app)/quotes/${quote.id}` as Parameters<typeof router.push>[0])}
              >
                <Card style={styles.quoteCard}>
                  <View style={styles.quoteHeader}>
                    <View>
                      <Text style={[typography.caption, { color: theme.textSecondary }]}>
                        {new Date(quote.createdAt).toLocaleDateString()}
                      </Text>
                      <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                        #{quote.quoteNumber}
                      </Text>
                    </View>
                    <StatusPill status={quote.status} />
                  </View>

                  <Text
                    style={[typography.caption, { color: theme.textSecondary, marginTop: spacing.xs }]}
                    numberOfLines={2}
                  >
                    {quote.scopeOfWork}
                  </Text>

                  <View style={styles.quoteFooter}>
                    <View>
                      <Text style={[typography.small, { color: theme.textSecondary }]}>Total Proposed</Text>
                      <Text style={[typography.h3, { color: theme.primary }]}>
                        {formatCurrency(Number(quote.totalAmount))}
                      </Text>
                    </View>
                    <View style={styles.reviewButton}>
                      <Text style={[typography.small, { color: "#FFFFFF", fontWeight: "700" }]}>
                        Review Scope
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
                    </View>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  backButton: {
    padding: 4,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  loader: {
    paddingVertical: 40,
    alignItems: "center",
  },
  list: {
    gap: spacing.md,
  },
  quoteCard: {
    padding: spacing.md,
  },
  quoteHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  quoteFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral200,
  },
  reviewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.violet700,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.full,
  },
});

