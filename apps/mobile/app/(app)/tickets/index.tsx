import { FlatList, Text, View, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { EmptyState } from "../../../src/components/EmptyState";
import { useAuthStore } from "../../../src/stores/auth-store";
import { apiRequest } from "../../../src/lib/api-client";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { spacing, typography } from "../../../src/theme/tokens";

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  organization?: { id: string; name: string };
}

export default function TicketsScreen() {
  const theme = useTheme();
  const { user, activeOrganizationId } = useAuthStore();
  const isStaff = user?.userType === "STAFF";

  // Staff see the whole support queue across every organization; a client
  // sees only their own organization's tickets.
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tickets", isStaff ? "queue" : activeOrganizationId],
    queryFn: () =>
      isStaff
        ? apiRequest<Ticket[]>("/api/v1/tickets")
        : apiRequest<Ticket[]>(`/api/v1/organizations/${activeOrganizationId}/tickets`),
    enabled: isStaff || Boolean(activeOrganizationId),
  });

  return (
    <ScreenContainer>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
        <Text style={[typography.h2, { color: theme.textPrimary }]}>Support</Text>
        {!isStaff ? (
          <Button label="New ticket" fullWidth={false} onPress={() => router.push("/(app)/tickets/new")} />
        ) : null}
      </View>

      <FlatList
        data={tickets ?? []}
        keyExtractor={(t) => t.id}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No tickets"
              description={isStaff ? "The queue is empty." : "Need help with something? Raise a ticket and we'll get back to you."}
              actionLabel={!isStaff ? "New ticket" : undefined}
              onAction={!isStaff ? () => router.push("/(app)/tickets/new") : undefined}
            />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(app)/tickets/${item.id}`)}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[typography.bodyStrong, { color: theme.textPrimary, flex: 1 }]}>{item.subject}</Text>
                <Text style={[typography.caption, { color: theme.textSecondary }]}>{item.priority}</Text>
              </View>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>
                {item.category} · {item.status}
                {item.organization ? ` · ${item.organization.name}` : ""}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}
