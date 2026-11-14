import { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { EmptyState } from "../../../src/components/EmptyState";
import { apiRequest } from "../../../src/lib/api-client";
import { formatCurrency } from "../../../src/lib/format";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { colors, radii, spacing, typography } from "../../../src/theme/tokens";

interface ServiceSearchResult {
  id: string;
  name: string;
  slug: string;
  summary: string;
  description: string;
  category: { id: string; name: string; slug: string };
  packages: {
    id: string;
    name: string;
    description: string;
    priceAmount: string;
    currency: string;
    expectedDurationDays?: number;
    features?: { label: string }[];
  }[];
}

const POPULAR_SUGGESTIONS = [
  "Salon Booking App",
  "High-Performance Website",
  "E-Commerce Store",
  "Mobile App Development",
  "SEO Growth",
  "Google Ads",
  "Business Automation",
  "AI Knowledge Agent",
];

const RECENT_SEARCHES_DEFAULT = ["Salon Software", "Mobile App", "Google Ads"];

export default function SearchScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"featured" | "price_asc" | "price_desc">("featured");
  const [recentSearches, setRecentSearches] = useState<string[]>(RECENT_SEARCHES_DEFAULT);

  // Debounce search input to avoid spamming the backend
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

  // Query categories for category filter pills
  const { data: categories } = useQuery({
    queryKey: ["catalogue-categories"],
    queryFn: () => apiRequest<{ id: string; name: string; slug: string }[]>("/api/v1/catalogue/categories"),
  });

  // Query backend search API with debounced keyword and optional category
  const { data: results, isLoading, isFetching } = useQuery({
    queryKey: ["catalogue-search", debouncedQuery, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedQuery) params.append("search", debouncedQuery);
      if (selectedCategory) params.append("categorySlug", selectedCategory);
      return apiRequest<ServiceSearchResult[]>(`/api/v1/catalogue/services?${params.toString()}`);
    },
    enabled: true,
  });

  const handleSelectQuery = (text: string) => {
    setQuery(text);
    if (!recentSearches.includes(text)) {
      setRecentSearches([text, ...recentSearches.slice(0, 4)]);
    }
  };

  const handleClearHistory = () => {
    setRecentSearches([]);
  };

  // Sort results
  const sortedResults = [...(results ?? [])].sort((a, b) => {
    const priceA = Number(a.packages[0]?.priceAmount ?? 0);
    const priceB = Number(b.packages[0]?.priceAmount ?? 0);
    if (sortBy === "price_asc") return priceA - priceB;
    if (sortBy === "price_desc") return priceB - priceA;
    return 0;
  });

  return (
    <ScreenContainer>
      {/* Search Bar Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <View style={[styles.searchInputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search" size={20} color={theme.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder="Search websites, mobile apps, AI, SEO..."
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => {
              if (query.trim()) handleSelectQuery(query.trim());
            }}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Category Pills Carousel */}
      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          <Pressable
            style={[
              styles.categoryChip,
              selectedCategory === null && { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === null ? { color: "#FFFFFF" } : { color: theme.textSecondary },
              ]}
            >
              All Services
            </Text>
          </Pressable>

          {(categories ?? []).map((cat) => {
            const isSelected = selectedCategory === cat.slug;
            return (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryChip,
                  isSelected && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
                onPress={() => setSelectedCategory(isSelected ? null : cat.slug)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isSelected ? { color: "#FFFFFF" } : { color: theme.textSecondary },
                  ]}
                >
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* If no search term entered, show suggestions and recent searches */}
        {query.length === 0 && selectedCategory === null ? (
          <View>
            {recentSearches.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[typography.caption, { color: theme.textSecondary, fontWeight: "600" }]}>
                    RECENT SEARCHES
                  </Text>
                  <Pressable onPress={handleClearHistory} hitSlop={8}>
                    <Text style={[typography.small, { color: colors.danger, fontWeight: "600" }]}>Clear</Text>
                  </Pressable>
                </View>
                <View style={styles.tagsGrid}>
                  {recentSearches.map((item, idx) => (
                    <Pressable
                      key={idx}
                      style={[styles.tagPill, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => handleSelectQuery(item)}
                    >
                      <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                      <Text style={[typography.caption, { color: theme.textPrimary }]}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View style={[styles.section, { marginTop: spacing.lg }]}>
              <Text style={[typography.caption, { color: theme.textSecondary, fontWeight: "600", marginBottom: spacing.sm }]}>
                POPULAR SEARCHES
              </Text>
              <View style={styles.tagsGrid}>
                {POPULAR_SUGGESTIONS.map((item, idx) => (
                  <Pressable
                    key={idx}
                    style={[styles.popularTagPill, { backgroundColor: colors.violet50 }]}
                    onPress={() => handleSelectQuery(item)}
                  >
                    <Ionicons name="trending-up" size={14} color={colors.violet700} />
                    <Text style={[typography.caption, { color: colors.violet700, fontWeight: "600" }]}>
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : (
          /* Search Results View */
          <View>
            {/* Sort bar & count */}
            <View style={styles.sortRow}>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>
                {isFetching ? "Searching..." : `${sortedResults.length} services found`}
              </Text>
              <View style={styles.sortActions}>
                <Pressable
                  style={[styles.sortButton, sortBy === "featured" && styles.sortButtonActive]}
                  onPress={() => setSortBy("featured")}
                >
                  <Text style={[styles.sortText, sortBy === "featured" && styles.sortTextActive]}>
                    Relevance
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.sortButton, sortBy === "price_asc" && styles.sortButtonActive]}
                  onPress={() => setSortBy("price_asc")}
                >
                  <Text style={[styles.sortText, sortBy === "price_asc" && styles.sortTextActive]}>
                    Price: Low
                  </Text>
                </Pressable>
              </View>
            </View>

            {isLoading ? (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 8 }]}>
                  Searching KryptonIX catalogue...
                </Text>
              </View>
            ) : sortedResults.length === 0 ? (
              <EmptyState
                title="No services found"
                description={`We couldn't find any service matching "${query}". Request a bespoke proposal for your specific needs.`}
                actionLabel="Submit Custom Requirement"
                onAction={() =>
                  router.push("/(app)/enquiry/new" as Parameters<typeof router.push>[0])
                }
              />
            ) : (
              <View style={styles.resultsList}>
                {sortedResults.map((service) => {
                  const cheapest = service.packages[0];
                  return (
                    <Pressable
                      key={service.id}
                      onPress={() =>
                        router.push(
                          `/(app)/services/${service.slug}` as Parameters<typeof router.push>[0],
                        )
                      }
                    >
                      <Card style={styles.serviceResultCard}>
                        <View style={styles.cardHeader}>
                          <View style={[styles.categoryBadge, { backgroundColor: colors.violet50 }]}>
                            <Text style={styles.categoryBadgeText}>{service.category?.name}</Text>
                          </View>
                          {cheapest && (
                            <View style={styles.pricePill}>
                              <Text style={styles.pricePillText}>
                                From {formatCurrency(Number(cheapest.priceAmount))}
                              </Text>
                            </View>
                          )}
                        </View>

                        <Text style={[typography.h3, { color: theme.textPrimary, marginTop: 6 }]}>
                          {service.name}
                        </Text>
                        <Text
                          style={[typography.caption, { color: theme.textSecondary, marginTop: 4 }]}
                          numberOfLines={2}
                        >
                          {service.summary}
                        </Text>

                        {cheapest && cheapest.features && (
                          <View style={styles.cardFeatures}>
                            {cheapest.features.slice(0, 2).map((f, i) => (
                              <View key={i} style={styles.featureLine}>
                                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                                <Text style={[typography.small, { color: theme.textSecondary }]}>
                                  {f.label}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}

                        <View style={styles.cardFooter}>
                          <Text style={[typography.small, { color: theme.primary, fontWeight: "700" }]}>
                            Explore Packages & Pricing
                          </Text>
                          <Ionicons name="chevron-forward" size={16} color={theme.primary} />
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            )}
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
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  backButton: {
    padding: 4,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  categoriesContainer: {
    marginVertical: spacing.xs,
  },
  categoryScroll: {
    gap: spacing.xs,
    paddingVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.neutral200,
    backgroundColor: colors.neutral0,
  },
  categoryChipText: {
    ...typography.small,
    fontWeight: "600",
  },
  content: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  tagsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  popularTagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sortActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  sortButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.neutral100,
  },
  sortButtonActive: {
    backgroundColor: colors.violet100,
  },
  sortText: {
    ...typography.small,
    color: colors.neutral600,
    fontWeight: "600",
  },
  sortTextActive: {
    color: colors.violet700,
  },
  loader: {
    alignItems: "center",
    paddingVertical: 40,
  },
  resultsList: {
    gap: spacing.md,
  },
  serviceResultCard: {
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  categoryBadgeText: {
    ...typography.small,
    color: colors.violet700,
    fontWeight: "700",
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
  cardFeatures: {
    marginTop: spacing.sm,
    gap: 4,
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
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral200,
  },
});

