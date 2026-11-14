import { useState } from "react";
import { FlatList, Text, Pressable, View, StyleSheet, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { EmptyState } from "../../../src/components/EmptyState";
import { FloatingCartBar } from "../../../src/components/FloatingCartBar";
import { apiRequest } from "../../../src/lib/api-client";
import { formatCurrency } from "../../../src/lib/format";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { colors, radii, spacing, typography } from "../../../src/theme/tokens";

interface Service {
  id: string;
  name: string;
  slug: string;
  summary: string;
  category: { id: string; name: string; slug: string };
  packages: {
    id: string;
    name: string;
    priceAmount: string;
    currency: string;
    expectedDurationDays?: number;
    features?: { label: string }[];
  }[];
}

const CATEGORY_STYLE: Record<string, { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string }> = {
  "website-development": { icon: "globe-outline", bg: "#DBEAFE", fg: "#1D4ED8" },
  "mobile-app-development": { icon: "phone-portrait-outline", bg: "#DCFCE7", fg: "#15803D" },
  "custom-software": { icon: "code-slash", bg: colors.violet100, fg: colors.violet700 },
  "ecommerce-solutions": { icon: "cart-outline", bg: "#FFE4E6", fg: "#E11D48" },
  "salon-gym-software": { icon: "barbell-outline", bg: "#FEF3C7", fg: "#B45309" },
  "booking-appointment-systems": { icon: "calendar-outline", bg: "#EDE9FE", fg: colors.violet700 },
  seo: { icon: "trending-up", bg: "#CCFBF1", fg: "#0F766E" },
  "digital-marketing": { icon: "megaphone-outline", bg: "#FFEDD5", fg: "#C2410C" },
  "google-ads": { icon: "logo-google", bg: "#FEE2E2", fg: "#DC2626" },
  "meta-ads": { icon: "logo-instagram", bg: "#FCE7F3", fg: "#BE185D" },
  "business-automation": { icon: "git-network-outline", bg: "#EDE9FE", fg: colors.violet700 },
  "ai-solutions": { icon: "hardware-chip-outline", bg: "#E0E7FF", fg: "#4338CA" },
  "custom-business-apps": { icon: "layers-outline", bg: "#F3F4F6", fg: colors.neutral700 },
};
const DEFAULT_CATEGORY_STYLE = { icon: "briefcase-outline" as const, bg: colors.neutral100, fg: colors.neutral600 };

export default function ServicesScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ categorySlug?: string }>();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(params.categorySlug ?? null);

  const { data: categories } = useQuery({
    queryKey: ["catalogue-categories"],
    queryFn: () => apiRequest<{ id: string; name: string; slug: string }[]>("/api/v1/catalogue/categories"),
  });

  const { data: services, isLoading } = useQuery({
    queryKey: ["catalogue", "services", selectedCategory],
    queryFn: () => {
      const q = selectedCategory ? `?categorySlug=${selectedCategory}` : "";
      return apiRequest<Service[]>(`/api/v1/catalogue/services${q}`, { auth: false });
    },
  });

  return (
    <ScreenContainer>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={[typography.h2, { color: theme.textPrimary }]}>Services & Solutions</Text>
          <Text style={[typography.caption, { color: theme.textSecondary }]}>
            Transparent packages, guaranteed deliverables, enterprise engineering.
          </Text>
        </View>
        <Pressable
          style={styles.searchIconBtn}
          onPress={() => router.push("/(app)/services/search" as Parameters<typeof router.push>[0])}
        >
          <Ionicons name="search" size={20} color={theme.primary} />
        </Pressable>
      </View>

      {/* Search Input Bar (Shortcut) */}
      <Pressable
        style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => router.push("/(app)/services/search" as Parameters<typeof router.push>[0])}
      >
        <Ionicons name="search" size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
        <Text style={[typography.body, { color: theme.textSecondary, flex: 1 }]}>
          Filter or search services...
        </Text>
      </Pressable>

      {/* Category Filter Chips */}
      <View style={styles.categoryPillsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPillsScroll}>
          <Pressable
            style={[
              styles.pillChip,
              selectedCategory === null && { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.pillText, selectedCategory === null ? { color: "#FFFFFF" } : { color: theme.textSecondary }]}>
              All Services
            </Text>
          </Pressable>

          {(categories ?? []).map((cat) => {
            const isSelected = selectedCategory === cat.slug;
            return (
              <Pressable
                key={cat.id}
                style={[
                  styles.pillChip,
                  isSelected && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
                onPress={() => setSelectedCategory(isSelected ? null : cat.slug)}
              >
                <Text style={[styles.pillText, isSelected ? { color: "#FFFFFF" } : { color: theme.textSecondary }]}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Services List */}
      <FlatList
        data={services ?? []}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No services found"
              description="No services currently configured under this category. Request a custom solution."
              actionLabel="Request Custom Quotation"
              onAction={() => router.push("/(app)/enquiry/new" as Parameters<typeof router.push>[0])}
            />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        renderItem={({ item }) => {
          const style = CATEGORY_STYLE[item.category.slug] ?? DEFAULT_CATEGORY_STYLE;
          const cheapest = item.packages[0];

          return (
            <Pressable
              onPress={() => router.push(`/(app)/services/${item.slug}` as Parameters<typeof router.push>[0])}
            >
              <Card style={styles.serviceCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBadge, { backgroundColor: style.bg }]}>
                    <Ionicons name={style.icon} size={24} color={style.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.small, { color: style.fg, fontWeight: "700" }]}>
                      {item.category.name.toUpperCase()}
                    </Text>
                    <Text style={[typography.h3, { color: theme.textPrimary, marginTop: 2 }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                </View>

                <Text style={[typography.caption, { color: theme.textSecondary, marginTop: spacing.sm, lineHeight: 18 }]} numberOfLines={2}>
                  {item.summary}
                </Text>

                {cheapest && (
                  <View style={styles.metaRow}>
                    <View style={styles.pricePill}>
                      <Text style={styles.pricePillText}>
                        Starting at {formatCurrency(Number(cheapest.priceAmount), cheapest.currency)}
                      </Text>
                    </View>
                    {cheapest.expectedDurationDays && (
                      <View style={styles.durationPill}>
                        <Ionicons name="time-outline" size={13} color={colors.neutral600} />
                        <Text style={styles.durationPillText}>{cheapest.expectedDurationDays} Days Delivery</Text>
                      </View>
                    )}
                  </View>
                )}

                {cheapest?.features && (
                  <View style={styles.featuresPreview}>
                    {cheapest.features.slice(0, 3).map((feat, i) => (
                      <View key={i} style={styles.featureLine}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                        <Text style={[typography.small, { color: theme.textSecondary, flex: 1 }]}>
                          {feat.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.cardFooter}>
                  <Text style={[typography.small, { color: theme.primary, fontWeight: "700" }]}>
                    Compare Packages & Pricing
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.primary} />
                </View>
              </Card>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Card style={styles.customBanner}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                Need a Custom Business Solution?
              </Text>
              <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 2 }]}>
                Submit your specific scope and get a tailored architectural quotation.
              </Text>
            </View>
            <Pressable
              style={styles.customBtn}
              onPress={() => router.push("/(app)/enquiry/new" as Parameters<typeof router.push>[0])}
            >
              <Text style={styles.customBtnText}>Enquire</Text>
            </Pressable>
          </Card>
        }
      />

      <FloatingCartBar />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  searchIconBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: colors.violet50,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 14,
    height: 42,
    marginBottom: spacing.sm,
  },
  categoryPillsWrapper: {
    marginBottom: spacing.md,
  },
  categoryPillsScroll: {
    gap: spacing.xs,
    paddingVertical: 2,
  },
  pillChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.neutral200,
    backgroundColor: colors.neutral0,
  },
  pillText: {
    ...typography.small,
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: spacing.xxl + 30,
  },
  serviceCard: {
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  pricePill: {
    backgroundColor: colors.violet50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  pricePillText: {
    ...typography.small,
    color: colors.violet700,
    fontWeight: "700",
  },
  durationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.neutral100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  durationPillText: {
    ...typography.small,
    color: colors.neutral700,
    fontWeight: "500",
  },
  featuresPreview: {
    marginTop: spacing.sm,
    gap: 4,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral200,
  },
  featureLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
  },
  customBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: colors.violet50,
    borderColor: colors.violet200,
    borderWidth: 1,
  },
  customBtn: {
    backgroundColor: colors.violet700,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    marginLeft: spacing.sm,
  },
  customBtnText: {
    ...typography.small,
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
