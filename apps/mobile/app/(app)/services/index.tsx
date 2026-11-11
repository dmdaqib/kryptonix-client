import { FlatList, Text, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { EmptyState } from "../../../src/components/EmptyState";
import { apiRequest } from "../../../src/lib/api-client";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { spacing, typography } from "../../../src/theme/tokens";

interface Service {
  id: string;
  name: string;
  slug: string;
  summary: string;
  category: { name: string };
}

export default function ServicesScreen() {
  const theme = useTheme();
  const { data: services, isLoading } = useQuery({
    queryKey: ["catalogue", "services"],
    queryFn: () => apiRequest<Service[]>("/api/v1/catalogue/services", { auth: false }),
  });

  return (
    <ScreenContainer>
      <Text style={[typography.h2, { color: theme.textPrimary, marginBottom: spacing.md }]}>Services</Text>
      <FlatList
        data={services ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState title="No services published yet" description="Check back soon." />
          ) : null
        }
        ItemSeparatorComponent={() => <Text style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(app)/services/${item.slug}`)}>
            <Card>
              <Text style={[typography.caption, { color: theme.primary }]}>{item.category.name}</Text>
              <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{item.name}</Text>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>{item.summary}</Text>
            </Card>
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}
