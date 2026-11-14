import { ScrollView, Text, View, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { useAuthStore } from "../../src/stores/auth-store";
import { useTheme } from "../../src/theme/ThemeProvider";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, activeOrganizationId, setActiveOrganization, logout } = useAuthStore();

  const isStaff = user?.userType === "STAFF";

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <Card style={styles.userCard}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <Text style={styles.avatarText}>{initials(user?.fullName)}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <View style={styles.nameRow}>
                <Text style={[typography.h2, { color: theme.textPrimary }]}>{user?.fullName}</Text>
                <View
                  style={[
                    styles.userTypeBadge,
                    { backgroundColor: isStaff ? colors.violet100 : colors.neutral100 },
                  ]}
                >
                  <Text
                    style={[
                      styles.userTypeBadgeText,
                      { color: isStaff ? colors.violet700 : colors.neutral700 },
                    ]}
                  >
                    {isStaff ? (user?.staffRole ?? "STAFF") : "CLIENT"}
                  </Text>
                </View>
              </View>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>{user?.email}</Text>
            </View>
          </View>
        </Card>

        {/* Staff Portal Shortcut (if staff) */}
        {isStaff && (
          <Pressable
            onPress={() => router.push("/(app)/staff" as Parameters<typeof router.push>[0])}
            style={{ marginTop: spacing.md }}
          >
            <Card style={styles.staffCard}>
              <View style={styles.staffIconCircle}>
                <Ionicons name="construct" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[typography.bodyStrong, { color: colors.violet700 }]}>
                  Staff Operations Hub
                </Text>
                <Text style={[typography.caption, { color: theme.textSecondary }]}>
                  Manage incoming enquiries, proposals, and support ticket queue.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.violet700} />
            </Card>
          </Pressable>
        )}

        {/* Organizations Section */}
        {user?.organizations && user.organizations.length > 0 && (
          <View style={styles.section}>
            <Text style={[typography.caption, { color: theme.textSecondary, fontWeight: "700", marginBottom: spacing.xs }]}>
              ORGANIZATION WORKSPACE
            </Text>
            {user.organizations.map((org) => {
              const isActive = org.id === activeOrganizationId;
              return (
                <Pressable key={org.id} onPress={() => setActiveOrganization(org.id)}>
                  <Card
                    style={[
                      styles.orgCard,
                      isActive && { borderColor: theme.primary, borderWidth: 1.5 },
                    ]}
                  >
                    <View style={styles.orgRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                          {org.name}
                        </Text>
                        <Text style={[typography.small, { color: theme.textSecondary }]}>
                          Role: {org.role} • Status: {org.approved ? "Active" : "Pending Approval"}
                        </Text>
                      </View>
                      {isActive ? (
                        <View style={styles.activeCheck}>
                          <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                        </View>
                      ) : (
                        <Text style={[typography.small, { color: theme.textSecondary }]}>Switch</Text>
                      )}
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Client Features Navigation Menu */}
        <View style={styles.section}>
          <Text style={[typography.caption, { color: theme.textSecondary, fontWeight: "700", marginBottom: spacing.xs }]}>
            COMMERCE & CLIENT PORTAL
          </Text>

          <Pressable onPress={() => router.push("/(app)/cart" as Parameters<typeof router.push>[0])}>
            <Card style={styles.menuItem}>
              <View style={styles.menuLeft}>
                <Ionicons name="cart-outline" size={20} color={theme.primary} />
                <Text style={[typography.body, { color: theme.textPrimary }]}>Shopping Cart</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Card>
          </Pressable>

          <Pressable onPress={() => router.push("/(app)/quotes" as Parameters<typeof router.push>[0])}>
            <Card style={styles.menuItem}>
              <View style={styles.menuLeft}>
                <Ionicons name="document-text-outline" size={20} color={theme.primary} />
                <Text style={[typography.body, { color: theme.textPrimary }]}>Quotations & Proposals</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Card>
          </Pressable>

          <Pressable onPress={() => router.push("/(app)/enquiry/new" as Parameters<typeof router.push>[0])}>
            <Card style={styles.menuItem}>
              <View style={styles.menuLeft}>
                <Ionicons name="options-outline" size={20} color={theme.primary} />
                <Text style={[typography.body, { color: theme.textPrimary }]}>Request Custom Quotation</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Card>
          </Pressable>

          <Pressable onPress={() => router.push("/(app)/invoices" as Parameters<typeof router.push>[0])}>
            <Card style={styles.menuItem}>
              <View style={styles.menuLeft}>
                <Ionicons name="card-outline" size={20} color={theme.primary} />
                <Text style={[typography.body, { color: theme.textPrimary }]}>Invoices & Payment History</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Card>
          </Pressable>

          <Pressable onPress={() => router.push("/(app)/tickets" as Parameters<typeof router.push>[0])}>
            <Card style={styles.menuItem}>
              <View style={styles.menuLeft}>
                <Ionicons name="help-buoy-outline" size={20} color={theme.primary} />
                <Text style={[typography.body, { color: theme.textPrimary }]}>Support Tickets</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Card>
          </Pressable>

          <Pressable onPress={() => router.push("/(app)/notifications" as Parameters<typeof router.push>[0])}>
            <Card style={styles.menuItem}>
              <View style={styles.menuLeft}>
                <Ionicons name="notifications-outline" size={20} color={theme.primary} />
                <Text style={[typography.body, { color: theme.textPrimary }]}>Notifications</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Card>
          </Pressable>
        </View>

        {/* Corporate Legal & Identity */}
        <View style={styles.companyInfoBox}>
          <Text style={[typography.small, { color: theme.textSecondary, fontWeight: "700" }]}>
            KRYPTONIX DIGITAL & AI SOLUTIONS PRIVATE LIMITED
          </Text>
          <Text style={[typography.small, { color: theme.textSecondary, marginTop: 2 }]}>
            CIN: U62011TS2026PTC212132 • Hyderabad, Telangana, India
          </Text>
          <Text style={[typography.small, { color: theme.primary, marginTop: 2 }]}>
            https://kryptonix.digital/
          </Text>
        </View>

        {/* Sign Out Action */}
        <View style={{ marginTop: spacing.lg }}>
          <Button label="Sign Out" variant="secondary" onPress={logout} />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  userCard: {
    padding: spacing.md,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    ...typography.h3,
    color: "#FFFFFF",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  userTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  userTypeBadgeText: {
    ...typography.small,
    fontWeight: "800",
  },
  staffCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.violet50,
    borderColor: colors.violet200,
    borderWidth: 1,
  },
  staffIconCircle: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: colors.violet700,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  orgCard: {
    padding: spacing.md,
  },
  orgRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  activeCheck: {
    marginLeft: spacing.sm,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  companyInfoBox: {
    alignItems: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
});
