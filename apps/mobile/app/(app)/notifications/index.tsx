import { FlatList, Text, View, Pressable } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { EmptyState } from "../../../src/components/EmptyState";
import { apiRequest } from "../../../src/lib/api-client";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { spacing, typography } from "../../../src/theme/tokens";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiRequest<NotificationItem[]>("/api/v1/notifications"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });

  const markReadMutation = useMutation({
    mutationFn: (notifId: string) => apiRequest(`/api/v1/notifications/${notifId}/read`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("/api/v1/notifications/read-all", { method: "POST" }),
    onSuccess: invalidate,
  });

  const notifications = data ?? [];
  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <ScreenContainer>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
        <Text style={[typography.h2, { color: theme.textPrimary }]}>Notifications</Text>
        {hasUnread ? (
          <Button
            label="Mark all read"
            variant="ghost"
            fullWidth={false}
            loading={markAllReadMutation.isPending}
            onPress={() => markAllReadMutation.mutate()}
          />
        ) : null}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={
          !isLoading ? <EmptyState title="No notifications yet" description="We'll let you know when something needs your attention." /> : null
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => !item.readAt && markReadMutation.mutate(item.id)}>
            <Card style={{ borderColor: item.readAt ? theme.border : theme.primary }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
                {!item.readAt ? (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary, marginTop: 6 }} />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{item.title}</Text>
                  <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 2 }]}>{item.body}</Text>
                  <Text style={[typography.small, { color: theme.textSecondary, marginTop: spacing.xs }]}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}
