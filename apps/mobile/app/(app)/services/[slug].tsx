import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  Alert,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { FloatingCartBar } from "../../../src/components/FloatingCartBar";
import { useCartStore } from "../../../src/stores/cart-store";
import { useAuthStore } from "../../../src/stores/auth-store";
import { apiRequest } from "../../../src/lib/api-client";
import { formatCurrency } from "../../../src/lib/format";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { colors, radii, spacing, typography } from "../../../src/theme/tokens";

interface ServicePackage {
  id: string;
  name: string;
  description: string;
  priceAmount: string;
  currency: string;
  taxPercent: string;
  expectedDurationDays: number | null;
  paymentTerms?: string | null;
  features: { id: string; label: string; included: boolean }[];
}

interface ServiceDetail {
  id: string;
  name: string;
  slug: string;
  summary: string;
  description: string;
  category: { id: string; name: string; slug: string };
  packages: ServicePackage[];
}

const FAQ_ITEMS = [
  {
    q: "How do milestone approvals work?",
    a: "Every project is divided into distinct, verifiable milestones. When KryptonIX submits a milestone deliverable, you review and approve it directly inside the app before remaining payments are due.",
  },
  {
    q: "Do I get full source code ownership?",
    a: "Yes. Upon completion and final payment, you receive full intellectual property and source code rights, along with production deployment documentation.",
  },
  {
    q: "Can I choose milestone payments?",
    a: "Yes. In the checkout flow you can choose either 100% full payment upfront or a 50% advance kickoff with 50% upon final delivery.",
  },
  {
    q: "What post-launch support is provided?",
    a: "Every package includes 30 to 60 days of post-launch bug fixing, performance monitoring, and team onboarding support.",
  },
];

export default function ServiceDetailScreen() {
  const theme = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user } = useAuthStore();
  const { addItem, items } = useCartStore();
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  const {
    data: service,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["catalogue", "service", slug],
    queryFn: () => apiRequest<ServiceDetail>(`/api/v1/catalogue/services/${slug}`, { auth: false }),
  });

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (isError || !service) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <Text style={[typography.h3, { color: theme.textPrimary }]}>Service not found</Text>
          <Button label="Return to Catalogue" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
        </View>
      </ScreenContainer>
    );
  }

  const handleAddToCart = (pkg: ServicePackage) => {
    addItem({
      serviceId: service.id,
      serviceName: service.name,
      serviceSlug: service.slug,
      categoryName: service.category.name,
      packageId: pkg.id,
      packageName: pkg.name,
      packageDescription: pkg.description,
      unitPrice: Number(pkg.priceAmount),
      taxPercent: Number(pkg.taxPercent) || 18,
      durationDays: pkg.expectedDurationDays ?? 30,
      features: pkg.features.filter((f) => f.included).map((f) => f.label),
    });

    Alert.alert(
      "Package Added to Cart",
      `"${pkg.name}" has been added to your cart. You can review the payment schedule, enter business details, and checkout.`,
      [
        { text: "Continue Browsing", style: "cancel" },
        {
          text: "View Cart",
          onPress: () => router.push("/(app)/cart" as Parameters<typeof router.push>[0]),
        },
      ],
    );
  };

  const handleBuyNow = (pkg: ServicePackage) => {
    addItem({
      serviceId: service.id,
      serviceName: service.name,
      serviceSlug: service.slug,
      categoryName: service.category.name,
      packageId: pkg.id,
      packageName: pkg.name,
      packageDescription: pkg.description,
      unitPrice: Number(pkg.priceAmount),
      taxPercent: Number(pkg.taxPercent) || 18,
      durationDays: pkg.expectedDurationDays ?? 30,
      features: pkg.features.filter((f) => f.included).map((f) => f.label),
    });
    router.push("/(app)/cart" as Parameters<typeof router.push>[0]);
  };

  return (
    <ScreenContainer>
      {/* Top Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={[typography.h3, { color: theme.textPrimary, flex: 1, marginLeft: 8 }]} numberOfLines={1}>
          {service.name}
        </Text>
        <Pressable
          style={styles.cartIconBtn}
          onPress={() => router.push("/(app)/cart" as Parameters<typeof router.push>[0])}
          hitSlop={8}
        >
          <Ionicons name="cart-outline" size={24} color={theme.textPrimary} />
          {items.length > 0 && <View style={styles.cartCountBadge} />}
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero Card */}
        <Card style={styles.heroCard}>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryPillText}>{service.category.name}</Text>
          </View>
          <Text style={[typography.h1, { color: theme.textPrimary, marginTop: 8 }]}>
            {service.name}
          </Text>
          <Text style={[typography.body, { color: theme.textSecondary, marginTop: 6, lineHeight: 22 }]}>
            {service.description}
          </Text>

          <View style={styles.heroHighlightRow}>
            <View style={styles.highlightBadge}>
              <Ionicons name="shield-checkmark" size={16} color={colors.violet700} />
              <Text style={styles.highlightText}>100% Milestone-Gated</Text>
            </View>
            <View style={styles.highlightBadge}>
              <Ionicons name="code-working" size={16} color={colors.violet700} />
              <Text style={styles.highlightText}>Source Code Ownership</Text>
            </View>
          </View>
        </Card>

        {/* Development Process / Roadmap */}
        <Text style={[typography.h3, { color: theme.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Engineering & Delivery Process
        </Text>
        <Card style={styles.processCard}>
          <View style={styles.stepRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNumText}>1</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                Discovery & Architecture
              </Text>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>
                Technical specifications, database schemas, and wireframe confirmation.
              </Text>
            </View>
          </View>

          <View style={styles.stepConnector} />

          <View style={styles.stepRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNumText}>2</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                Core Feature Implementation
              </Text>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>
                Rapid milestone sprint delivering APIs, screens, and database services.
              </Text>
            </View>
          </View>

          <View style={styles.stepConnector} />

          <View style={styles.stepRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNumText}>3</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                QA, Testing & Client Review
              </Text>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>
                Rigorous testing on iOS & Android. You test deliverables directly.
              </Text>
            </View>
          </View>

          <View style={styles.stepConnector} />

          <View style={styles.stepRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNumText}>4</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                Production Handover & Launch
              </Text>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>
                App store releases, cloud deployment, training and 30-day warranty.
              </Text>
            </View>
          </View>
        </Card>

        {/* Packages & Pricing Section */}
        <Text style={[typography.h3, { color: theme.textPrimary, marginTop: spacing.lg, marginBottom: spacing.xs }]}>
          Available Packages
        </Text>
        <Text style={[typography.caption, { color: theme.textSecondary, marginBottom: spacing.md }]}>
          Select a package to view deliverables or proceed to checkout:
        </Text>

        <View style={styles.packagesContainer}>
          {service.packages.map((pkg, idx) => {
            const isFirst = idx === 0;
            return (
              <Card key={pkg.id} style={styles.packageCard}>
                <View style={styles.packageHeader}>
                  <View style={{ flex: 1 }}>
                    {isFirst && (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedText}>MOST POPULAR</Text>
                      </View>
                    )}
                    <Text style={[typography.h2, { color: theme.textPrimary, marginTop: 4 }]}>
                      {pkg.name}
                    </Text>
                    <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 2 }]}>
                      {pkg.description}
                    </Text>
                  </View>
                </View>

                {/* Price Display */}
                <View style={styles.priceRow}>
                  <Text style={[typography.h1, { color: theme.primary }]}>
                    {formatCurrency(Number(pkg.priceAmount), pkg.currency)}
                  </Text>
                  <Text style={[typography.caption, { color: theme.textSecondary, marginLeft: 6 }]}>
                    + 18% GST
                  </Text>
                </View>

                {pkg.expectedDurationDays && (
                  <View style={styles.durationBadge}>
                    <Ionicons name="time-outline" size={15} color={colors.violet700} />
                    <Text style={styles.durationText}>
                      Delivery Timeline: ~{pkg.expectedDurationDays} Business Days
                    </Text>
                  </View>
                )}

                {/* Features List */}
                <View style={styles.featuresList}>
                  <Text style={[typography.small, { color: theme.textSecondary, fontWeight: "700", marginBottom: 6 }]}>
                    INCLUDED DELIVERABLES:
                  </Text>
                  {pkg.features.map((feat) => (
                    <View key={feat.id} style={styles.featRow}>
                      <Ionicons
                        name={feat.included ? "checkmark-circle" : "close-circle-outline"}
                        size={18}
                        color={feat.included ? colors.success : colors.neutral400}
                      />
                      <Text
                        style={[
                          typography.caption,
                          { color: feat.included ? theme.textPrimary : theme.textSecondary, flex: 1 },
                        ]}
                      >
                        {feat.label}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Package Action Buttons */}
                <View style={styles.packageButtons}>
                  <Button
                    label="Add to Cart"
                    variant="outline"
                    onPress={() => handleAddToCart(pkg)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Buy Package"
                    onPress={() => handleBuyNow(pkg)}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            );
          })}
        </View>

        {/* Custom Requirement CTA */}
        <Card style={styles.customCtaCard}>
          <Ionicons name="options-outline" size={32} color={colors.violet700} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
              Need Custom Features or Scale?
            </Text>
            <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 2 }]}>
              Submit your bespoke requirements. Our solutions team will generate an architectural scope and quote.
            </Text>
          </View>
          <Button
            label="Request Scope"
            size="sm"
            onPress={() => router.push("/(app)/enquiry/new" as Parameters<typeof router.push>[0])}
            style={{ marginLeft: spacing.sm }}
          />
        </Card>

        {/* FAQ Accordion */}
        <Text style={[typography.h3, { color: theme.textPrimary, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
          Frequently Asked Questions
        </Text>
        <Card style={styles.faqCard}>
          {FAQ_ITEMS.map((faq, idx) => {
            const isExpanded = expandedFaqIndex === idx;
            return (
              <View key={idx} style={styles.faqItem}>
                <Pressable
                  style={styles.faqQuestionRow}
                  onPress={() => setExpandedFaqIndex(isExpanded ? null : idx)}
                >
                  <Text style={[typography.bodyStrong, { color: theme.textPrimary, flex: 1 }]}>
                    {faq.q}
                  </Text>
                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={theme.textSecondary}
                  />
                </Pressable>
                {isExpanded && (
                  <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 6, lineHeight: 20 }]}>
                    {faq.a}
                  </Text>
                )}
              </View>
            );
          })}
        </Card>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Zomato-Style Cart Bar */}
      <FloatingCartBar />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  backButton: {
    padding: 4,
  },
  cartIconBtn: {
    padding: 4,
    position: "relative",
  },
  cartCountBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.danger,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  heroCard: {
    padding: spacing.md,
  },
  categoryPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.violet50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  categoryPillText: {
    ...typography.small,
    color: colors.violet700,
    fontWeight: "700",
  },
  heroHighlightRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral200,
  },
  highlightBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.violet50,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  highlightText: {
    ...typography.small,
    color: colors.violet700,
    fontWeight: "600",
  },
  processCard: {
    padding: spacing.md,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  stepNumCircle: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: colors.violet700,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  stepConnector: {
    width: 2,
    height: 20,
    backgroundColor: colors.violet200,
    marginLeft: 13,
    marginVertical: 2,
  },
  packagesContainer: {
    gap: spacing.md,
  },
  packageCard: {
    padding: spacing.md,
  },
  packageHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  recommendedBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.violet50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  recommendedText: {
    ...typography.small,
    color: colors.violet700,
    fontWeight: "800",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: spacing.sm,
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.violet50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
    alignSelf: "flex-start",
    marginTop: spacing.xs,
  },
  durationText: {
    ...typography.small,
    color: colors.violet700,
    fontWeight: "600",
  },
  featuresList: {
    marginTop: spacing.md,
    gap: 8,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral200,
  },
  featRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  packageButtons: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  customCtaCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: colors.violet50,
    borderColor: colors.violet200,
    borderWidth: 1,
  },
  faqCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  faqItem: {
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral200,
  },
  faqQuestionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
});
