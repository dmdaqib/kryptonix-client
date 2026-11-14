import { FlatList, Text, View, Pressable, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { EmptyState } from "../../../src/components/EmptyState";
import { StatusPill } from "../../../src/components/StatusPill";
import { useAuthStore } from "../../../src/stores/auth-store";
import { apiRequest } from "../../../src/lib/api-client";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { colors, radii, spacing, typography } from "../../../src/theme/tokens";

interface Project {
  id: string;
  name: string;
  status: string;
  startDate?: string | null;
  expectedDeliveryDate: string | null;
}

export default function ProjectsScreen() {
  const theme = useTheme();
  const { activeOrganizationId } = useAuthStore();

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects", activeOrganizationId],
    queryFn: () => apiRequest<Project[]>(`/api/v1/organizations/${activeOrganizationId}/projects`),
    enabled: Boolean(activeOrganizationId),
  });

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View>
          <Text style={[typography.h2, { color: theme.textPrimary }]}>Projects Workspace</Text>
          <Text style={[typography.caption, { color: theme.textSecondary }]}>
            Real-time milestone tracking, deliverables review, and direct team chat.
          </Text>
        </View>
      </View>

      <FlatList
        data={projects ?? []}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No active projects yet"
              description="When you purchase a package or approve a quotation, your dedicated workspace and milestones will appear here."
              actionLabel="Explore Services"
              onAction={() => router.push("/(app)/services" as Parameters<typeof router.push>[0])}
            />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(app)/projects/${item.id}` as Parameters<typeof router.push>[0])}
          >
            <Card style={styles.projectCard}>
              <View style={styles.topRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[typography.h3, { color: theme.textPrimary }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.expectedDeliveryDate && (
                    <Text style={[typography.small, { color: theme.textSecondary, marginTop: 2 }]}>
                      Target Delivery: {new Date(item.expectedDeliveryDate).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <StatusPill status={item.status} />
              </View>

              <View style={styles.footerRow}>
                <View style={styles.chatBadge}>
                  <Ionicons name="chatbubbles-outline" size={14} color={colors.violet700} />
                  <Text style={styles.chatBadgeText}>Team Chat</Text>
                </View>
                <View style={styles.actionRight}>
                  <Text style={[typography.small, { color: theme.primary, fontWeight: "700" }]}>
                    Open Workspace
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.primary} />
                </View>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  projectCard: {
    padding: spacing.md,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral200,
  },
  chatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.violet50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  chatBadgeText: {
    ...typography.small,
    color: colors.violet700,
    fontWeight: "600",
  },
  actionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
});
