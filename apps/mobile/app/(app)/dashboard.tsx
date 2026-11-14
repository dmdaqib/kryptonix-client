import { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { Card } from "../../src/components/Card";
import { StatusPill } from "../../src/components/StatusPill";
import { FloatingCartBar } from "../../src/components/FloatingCartBar";
import { useAuthStore } from "../../src/stores/auth-store";
import { apiRequest } from "../../src/lib/api-client";
import { formatCurrency } from "../../src/lib/format";
import { useTheme } from "../../src/theme/ThemeProvider";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

const { width } = Dimensions.get("window");

interface ProjectItem {
  id: string;
  name: string;
  status: string;
  startDate?: string;
  expectedDeliveryDate?: string;
  milestones: { id: string; name: string; status: string }[];
}

interface ServiceItem {
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

const CATEGORY_ITEMS: {
  title: string;
  slug: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
}[] = [
  { title: "Custom Apps", slug: "custom-software", icon: "code-slash", color: colors.violet700, bgColor: colors.violet50 },
  { title: "Websites", slug: "website-development", icon: "globe-outline", color: "#2563EB", bgColor: "#EFF6FF" },
  { title: "Mobile Apps", slug: "mobile-app-development", icon: "phone-portrait-outline", color: "#059669", bgColor: "#ECFDF5" },
  { title: "Salon & Gym", slug: "salon-gym-software", icon: "barbell-outline", color: "#D97706", bgColor: "#FFFBEB" },
  { title: "E-Commerce", slug: "ecommerce-solutions", icon: "cart-outline", color: "#E11D48", bgColor: "#FFF1F2" },
  { title: "Booking", slug: "booking-appointment-systems", icon: "calendar-outline", color: "#7C3AED", bgColor: "#F5F3FF" },
  { title: "SEO Growth", slug: "seo", icon: "trending-up-outline", color: "#0D9488", bgColor: "#F0FDFA" },
  { title: "AI & Auto", slug: "ai-solutions", icon: "hardware-chip-outline", color: "#4F46E5", bgColor: "#EEF2FF" },
];

const PROMOTIONAL_BANNERS = [
  {
    title: "End-to-End Digital Engineering",
    subtitle: "Custom Web & Mobile Apps Built for High Scale",
    badge: "ENTERPRISE QUALITY",
    color: colors.violet700,
  },
  {
    title: "Salon & Gym Platforms",
    subtitle: "Automate Bookings, Staff Rosters & POS In One Dashboard",
    badge: "MOST POPULAR",
    color: "#4C1D95",
  },
  {
    title: "24/7 AI Assistants",
    subtitle: "Automate Support, Lead Qualification & Operations",
    badge: "AI-FIRST",
    color: "#1E1B4B",
  },
];

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export default function HomeScreen() {
  const theme = useTheme();
  const { user, activeOrganizationId } = useAuthStore();
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);

  // Active projects for the client organization
  const { data: projects } = useQuery({
    queryKey: ["projects", activeOrganizationId],
    queryFn: () => apiRequest<ProjectItem[]>(`/api/v1/organizations/${activeOrganizationId}/projects`),
    enabled: Boolean(activeOrganizationId),
  });

  // Services catalogue
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ["catalogue-services-featured"],
    queryFn: () => apiRequest<ServiceItem[]>("/api/v1/catalogue/services"),
  });

  // Unread notifications count
  const { data: notifications } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => apiRequest<{ id: string; readAt: string | null }[]>("/api/v1/notifications"),
  });

  const unreadCount = (notifications ?? []).filter((n) => !n.readAt).length;
  const activeProjects = (projects ?? []).filter((p) => p.status !== "COMPLETED" && p.status !== "CANCELLED");

  return (
    <ScreenContainer>
      {/* Top App Header */}
      <View style={styles.topHeader}>
        <View style={styles.brandingBox}>
          <View style={styles.logoPill}>
            <Text style={styles.logoKText}>K</Text>
          </View>
          <View>
            <Text style={styles.companyName}>KRYPTONIX</Text>
            <Text style={styles.companyTagline}>Digital & AI Solutions</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <Pressable
            style={styles.iconButton}
            onPress={() => router.push("/(app)/notifications" as Parameters<typeof router.push>[0])}
          >
            <Ionicons name="notifications-outline" size={22} color={theme.textPrimary} />
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>

          <Pressable onPress={() => router.push("/(app)/profile" as Parameters<typeof router.push>[0])}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <Text style={[typography.bodyStrong, { color: theme.primaryText }]}>
                {initials(user?.fullName)}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Welcome Greeting */}
        <View style={styles.greetingRow}>
          <Text style={[typography.caption, { color: theme.textSecondary }]}>Welcome to KryptonIX</Text>
          <Text style={[typography.h2, { color: theme.textPrimary }]}>
            Hello, {user?.fullName?.split(" ")[0] ?? "there"} 👋
          </Text>
        </View>

        {/* Zomato-Style Search Bar */}
        <Pressable
          style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => router.push("/(app)/services/search" as Parameters<typeof router.push>[0])}
        >
          <Ionicons name="search" size={20} color={theme.primary} style={{ marginRight: 10 }} />
          <Text style={[typography.body, { color: theme.textSecondary, flex: 1 }]}>
            Search websites, apps, AI, SEO...
          </Text>
          <View style={styles.searchMic}>
            <Ionicons name="sparkles" size={16} color={theme.primary} />
          </View>
        </Pressable>

        {/* Promotional Carousel */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            const index = Math.round(x / (width - 32));
            setActiveBannerIndex(index);
          }}
          scrollEventThrottle={16}
          style={styles.bannerCarousel}
        >
          {PROMOTIONAL_BANNERS.map((banner, index) => (
            <View key={index} style={[styles.bannerSlide, { backgroundColor: banner.color }]}>
              <View style={styles.bannerBadge}>
                <Text style={styles.bannerBadgeText}>{banner.badge}</Text>
              </View>
              <Text style={styles.bannerTitle}>{banner.title}</Text>
              <Text style={styles.bannerSubtitle}>{banner.subtitle}</Text>
              <Pressable
                style={styles.bannerButton}
                onPress={() => router.push("/(app)/services" as Parameters<typeof router.push>[0])}
              >
                <Text style={styles.bannerButtonText}>Explore Solutions</Text>
                <Ionicons name="arrow-forward" size={14} color={banner.color} />
              </Pressable>
            </View>
          ))}
        </ScrollView>

        {/* Category Icons Grid */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.h3, { color: theme.textPrimary }]}>Categories</Text>
          <Pressable onPress={() => router.push("/(app)/services" as Parameters<typeof router.push>[0])}>
            <Text style={[typography.caption, { color: theme.primary, fontWeight: "700" }]}>View All →</Text>
          </Pressable>
        </View>

        <View style={styles.categoriesGrid}>
          {CATEGORY_ITEMS.map((cat, idx) => (
            <Pressable
              key={idx}
              style={styles.categoryItem}
              onPress={() =>
                router.push({
                  pathname: "/(app)/services",
                  params: { categorySlug: cat.slug },
                } as Parameters<typeof router.push>[0])
              }
            >
              <View style={[styles.categoryIconCircle, { backgroundColor: cat.bgColor }]}>
                <Ionicons name={cat.icon} size={24} color={cat.color} />
              </View>
              <Text style={[typography.small, { color: theme.textPrimary, fontWeight: "600", marginTop: 6, textAlign: "center" }]}>
                {cat.title}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Active Projects Tracker (For signed-in customers) */}
        {activeProjects.length > 0 && (
          <View style={styles.activeProjectsSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[typography.h3, { color: theme.textPrimary }]}>Active Projects</Text>
              <Pressable onPress={() => router.push("/(app)/projects" as Parameters<typeof router.push>[0])}>
                <Text style={[typography.caption, { color: theme.primary, fontWeight: "700" }]}>All Projects →</Text>
              </Pressable>
            </View>

            {activeProjects.slice(0, 2).map((project) => {
              const totalM = project.milestones?.length ?? 1;
              const completedM = (project.milestones ?? []).filter((m) => m.status === "APPROVED").length;
              const percent = Math.round((completedM / Math.max(1, totalM)) * 100);

              return (
                <Pressable
                  key={project.id}
                  onPress={() => router.push(`/(app)/projects/${project.id}` as Parameters<typeof router.push>[0])}
                >
                  <Card style={styles.projectCard}>
                    <View style={styles.projectCardHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{project.name}</Text>
                        <Text style={[typography.small, { color: theme.textSecondary, marginTop: 2 }]}>
                          Milestones: {completedM} of {totalM} Completed
                        </Text>
                      </View>
                      <StatusPill status={project.status} />
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: `${Math.max(8, percent)}%`, backgroundColor: colors.success }]} />
                    </View>

                    <View style={styles.projectCardFooter}>
                      <Text style={[typography.small, { color: theme.primary, fontWeight: "700" }]}>
                        Workspace & Deliverables
                      </Text>
                      <Ionicons name="arrow-forward" size={14} color={theme.primary} />
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Featured Solutions Cards */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.h3, { color: theme.textPrimary }]}>Popular Solutions</Text>
          <Pressable onPress={() => router.push("/(app)/services" as Parameters<typeof router.push>[0])}>
            <Text style={[typography.caption, { color: theme.primary, fontWeight: "700" }]}>See Catalogue →</Text>
          </Pressable>
        </View>

        {servicesLoading ? (
          <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 20 }} />
        ) : (
          <View style={styles.featuredServicesList}>
            {(services ?? []).slice(0, 4).map((service) => {
              const cheapest = service.packages[0];
              return (
                <Pressable
                  key={service.id}
                  onPress={() =>
                    router.push(`/(app)/services/${service.slug}` as Parameters<typeof router.push>[0])
                  }
                >
                  <Card style={styles.featuredServiceCard}>
                    <View style={styles.featuredServiceTop}>
                      <View style={styles.featuredCategoryPill}>
                        <Text style={styles.featuredCategoryText}>{service.category.name}</Text>
                      </View>
                      {cheapest && (
                        <View style={styles.startingPricePill}>
                          <Text style={styles.startingPriceText}>
                            From {formatCurrency(Number(cheapest.priceAmount))}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={[typography.h3, { color: theme.textPrimary, marginTop: 8 }]}>
                      {service.name}
                    </Text>
                    <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 4 }]} numberOfLines={2}>
                      {service.summary}
                    </Text>

                    {cheapest?.features && (
                      <View style={styles.featuresPreviewList}>
                        {cheapest.features.slice(0, 2).map((feat, i) => (
                          <View key={i} style={styles.featurePreviewRow}>
                            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                            <Text style={[typography.small, { color: theme.textSecondary, flex: 1 }]}>
                              {feat.label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={styles.cardBottomRow}>
                      <Text style={[typography.small, { color: theme.primary, fontWeight: "700" }]}>
                        View Packages & Pricing
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={theme.primary} />
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Why Choose KryptonIX */}
        <Card style={styles.whyUsCard}>
          <Text style={[typography.h3, { color: theme.textPrimary, marginBottom: spacing.sm }]}>
            Why Work With KryptonIX?
          </Text>
          <View style={styles.whyUsItem}>
            <View style={styles.whyUsIcon}>
              <Ionicons name="shield-checkmark" size={20} color={colors.violet700} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>Milestone-Gated Delivery</Text>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>
                Payments are linked to verifiable deliverables. You review and approve before final sign-off.
              </Text>
            </View>
          </View>

          <View style={styles.whyUsItem}>
            <View style={styles.whyUsIcon}>
              <Ionicons name="hardware-chip" size={20} color={colors.violet700} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>Modern Scalable Tech Stack</Text>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>
                React Native, Node.js, Fastify, PostgreSQL and cloud-native architecture built for scale.
              </Text>
            </View>
          </View>

          <View style={styles.whyUsItem}>
            <View style={styles.whyUsIcon}>
              <Ionicons name="chatbubbles" size={20} color={colors.violet700} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>Direct Dedicated Workspace</Text>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>
                Communicate directly with your assigned project manager, developers, and designers.
              </Text>
            </View>
          </View>
        </Card>

        {/* Custom Requirement Call to Action */}
        <Card style={styles.ctaCard}>
          <View style={styles.ctaBadge}>
            <Text style={styles.ctaBadgeText}>CUSTOM ENTERPRISE SCOPE</Text>
          </View>
          <Text style={[typography.h2, { color: "#FFFFFF", marginTop: 6 }]}>
            Have a custom requirement?
          </Text>
          <Text style={[typography.caption, { color: "rgba(255,255,255,0.85)", marginTop: 4, lineHeight: 18 }]}>
            Tell us about your business bottleneck or software vision. We will prepare an architectural proposal within 24 hours.
          </Text>
          <Pressable
            style={styles.ctaButton}
            onPress={() => router.push("/(app)/enquiry/new" as Parameters<typeof router.push>[0])}
          >
            <Text style={styles.ctaButtonText}>Request Custom Quotation</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.violet900} />
          </Pressable>
        </Card>

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* Floating Zomato-Style Cart Bar */}
      <FloatingCartBar />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  brandingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  logoPill: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.violet700,
    alignItems: "center",
    justifyContent: "center",
  },
  logoKText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  companyName: {
    ...typography.bodyStrong,
    color: colors.neutral900,
    letterSpacing: 1,
    lineHeight: 18,
  },
  companyTagline: {
    ...typography.small,
    color: colors.neutral500,
    lineHeight: 14,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.neutral100,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  unreadBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: colors.danger,
    borderRadius: radii.full,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  unreadBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  greetingRow: {
    marginBottom: spacing.sm,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  searchMic: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: colors.violet50,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerCarousel: {
    marginBottom: spacing.lg,
  },
  bannerSlide: {
    width: width - 32,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginRight: spacing.sm,
    justifyContent: "space-between",
  },
  bannerBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    marginBottom: spacing.xs,
  },
  bannerBadgeText: {
    ...typography.small,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  bannerTitle: {
    ...typography.h2,
    color: "#FFFFFF",
  },
  bannerSubtitle: {
    ...typography.caption,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
    marginBottom: spacing.md,
  },
  bannerButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.full,
  },
  bannerButtonText: {
    ...typography.caption,
    fontWeight: "700",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  categoryItem: {
    width: "23%",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  categoryIconCircle: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  activeProjectsSection: {
    marginBottom: spacing.lg,
  },
  projectCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  projectCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: colors.neutral200,
    borderRadius: radii.full,
    marginVertical: spacing.sm,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    borderRadius: radii.full,
  },
  projectCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  featuredServicesList: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  featuredServiceCard: {
    padding: spacing.md,
  },
  featuredServiceTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  featuredCategoryPill: {
    backgroundColor: colors.violet50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  featuredCategoryText: {
    ...typography.small,
    color: colors.violet700,
    fontWeight: "700",
  },
  startingPricePill: {
    backgroundColor: colors.violet50,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  startingPriceText: {
    ...typography.small,
    color: colors.violet700,
    fontWeight: "700",
  },
  featuresPreviewList: {
    marginTop: spacing.sm,
    gap: 4,
  },
  featurePreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral200,
  },
  whyUsCard: {
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  whyUsItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  whyUsIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.violet50,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaCard: {
    backgroundColor: colors.violet900,
    padding: spacing.lg,
    borderRadius: radii.lg,
  },
  ctaBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  ctaBadgeText: {
    ...typography.small,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    borderRadius: radii.full,
    marginTop: spacing.md,
  },
  ctaButtonText: {
    ...typography.bodyStrong,
    color: colors.violet900,
  },
});
