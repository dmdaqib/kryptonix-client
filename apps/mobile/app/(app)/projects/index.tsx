import { FlatList, Text, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { EmptyState } from "../../../src/components/EmptyState";
import { useAuthStore } from "../../../src/stores/auth-store";
import { apiRequest } from "../../../src/lib/api-client";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { spacing, typography } from "../../../src/theme/tokens";

interface Project {
  id: string;
  name: string;
  status: string;
  expectedDeliveryDate: string | null;
}

export default function ProjectsScreen() {
  const theme = useTheme();
  const { activeOrganizationId } = useAuthStore();

  // NOTE: /api/v1/organizations/:id/projects is part of P3 (Project
  // Management) and is scaffolded in the Prisma schema + docs but its route
  // handlers aren't implemented yet — see PROGRESS.md. This screen is wired
  // to call it so no further UI work is needed once that route ships.
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects", activeOrganizationId],
    queryFn: () => apiRequest<Project[]>(`/api/v1/organizations/${activeOrganizationId}/projects`),
    enabled: Boolean(activeOrganizationId),
  });

  return (
    <ScreenContainer>
      <Text style={[typography.h2, { color: theme.textPrimary, marginBottom: spacing.md }]}>Projects</Text>
      <FlatList
        data={projects ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No active projects"
              description="Once you accept a quote, your project will appear here."
            />
          ) : null
        }
        ItemSeparatorComponent={() => <Text style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(app)/projects/${item.id}`)}>
            <Card>
              <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{item.name}</Text>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>{item.status}</Text>
            </Card>
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}
