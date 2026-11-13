import { FlatList, Text, Pressable, View, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { EmptyState } from "../../../src/components/EmptyState";
import { apiRequest } from "../../../src/lib/api-client";
import { formatCurrency } from "../../../src/lib/format";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { colors, radii, spacing, typography } from "../../../src/theme/tokens";

interface Service {
  id: string;
  name: string;
  slug: string;
  summary: string;
  category: { name: string; slug: string };
  packages: { priceAmount: string; currency: string }[];
}

// One icon + accent color per category slug, so the list reads as a real
// product catalogue (like a services marketplace) instead of plain text
// rows. Falls back to a generic icon for any category not listed here.
const CATEGORY_STYLE: Record<string, { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string }> = {
  "custom-software": { icon: "code-slash", bg: colors.violet100, fg: colors.violet700 },
  "salon-gym-software": { icon: "cut", bg: "#FCE7F3", fg: "#BE185D" },
  "websites-booking": { icon: "globe-outline", bg: "#DBEAFE", fg: "#1D4ED8" },
  seo: { icon: "trending-up", bg: "#DCFCE7", fg: "#15803D" },
  "paid-ads": { icon: "megaphone-outline", bg: "#FFEDD5", fg: "#C2410C" },
  "automation-ai": { icon: "sparkles", bg: "#EDE9FE", fg: colors.violet700 },
};
const DEFAULT_CATEGORY_STYLE = { icon: "briefcase-outline" as const, bg: colors.neutral100, fg: colors.neutral600 };

export default function ServicesScreen() {
  const theme = useTheme();
  const { data: services, isLoading } = useQuery({
    queryKey: ["catalogue", "services"],
    queryFn: () => apiRequest<Service[]>("/api/v1/catalogue/services", { auth: false }),
  });

  return (
    <ScreenContainer>
      <Text style={[typography.h2, { color: theme.textPrimary }]}>Services</Text>
      <Text style={[typography.body, { color: theme.textSecondary, marginBottom: spacing.lg }]}>
        Everything KryptonIX offers, with real pricing — tap a service to see packages and request a quote.
      </Text>
      <FlatList
        data={services ?? []}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState title="No services published yet" description="Check back soon." />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => {
          const style = CATEGORY_STYLE[item.category.slug] ?? DEFAULT_CATEGORY_STYLE;
          const fromPrice = item.packages[0];
          return (
            <Pressable onPress={() => router.push(`/(app)/services/${item.slug}`)}>
              <Card style={styles.row}>
                <View style={[styles.iconBadge, { backgroundColor: style.bg }]}>
                  <Ionicons name={style.icon} size={22} color={style.fg} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={[typography.caption, { color: theme.primary }]} numberOfLines={1}>
                    {item.category.name.toUpperCase()}
                  </Text>
                  <Text style={[typography.bodyStrong, { color: theme.textPrimary }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[typography.caption, { color: theme.textSecondary }]} numberOfLines={2}>
                    {item.summary}
                  </Text>
                  {fromPrice ? (
                    <Text style={[typography.small, { color: theme.textPrimary, marginTop: spacing.xs, fontWeight: "600" }]}>
                      Starting at {formatCurrency(fromPrice.priceAmount, fromPrice.currency)}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
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
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
});
