import { useState } from "react";
import { FlatList, Text, View, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "../../../../src/components/ScreenContainer";
import { Button } from "../../../../src/components/Button";
import { TextField } from "../../../../src/components/TextField";
import { useAuthStore } from "../../../../src/stores/auth-store";
import { apiRequest } from "../../../../src/lib/api-client";
import { useTheme } from "../../../../src/theme/ThemeProvider";
import { spacing, radii, typography } from "../../../../src/theme/tokens";

interface Message {
  id: string;
  body: string | null;
  isInternalNote: boolean;
  createdAt: string;
  sender: { id: string; fullName: string; userType: "CLIENT" | "STAFF" };
}

export default function ProjectMessagesScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isStaff = user?.userType === "STAFF";

  const [draft, setDraft] = useState("");
  const [internalNote, setInternalNote] = useState(false);

  const { data: conversation } = useQuery({
    queryKey: ["project-conversation", id],
    queryFn: () => apiRequest<{ id: string }>(`/api/v1/projects/${id}/conversation`),
    enabled: Boolean(id),
  });

  const conversationId = conversation?.id;

  const { data: messages } = useQuery({
    queryKey: ["conversation-messages", conversationId],
    queryFn: () => apiRequest<Message[]>(`/api/v1/conversations/${conversationId}/messages`),
    enabled: Boolean(conversationId),
    // Simple polling instead of a websocket connection — there's no
    // realtime transport wired up in this build (see PROGRESS.md).
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/conversations/${conversationId}/messages`, {
        method: "POST",
        body: { body: draft.trim(), isInternalNote: internalNote },
      }),
    onSuccess: () => {
      setDraft("");
      setInternalNote(false);
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
    },
  });

  return (
    <ScreenContainer style={{ padding: 0 }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Text style={[typography.h2, { color: theme.textPrimary }]}>Project chat</Text>
      </View>

      <FlatList
        data={messages ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        inverted={false}
        renderItem={({ item }) => {
          const mine = item.sender.id === user?.id;
          return (
            <View
              style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                maxWidth: "82%",
                backgroundColor: item.isInternalNote ? `${theme.warning}22` : mine ? theme.primary : theme.surface,
                borderRadius: radii.lg,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            >
              {!mine ? (
                <Text style={[typography.small, { color: theme.textSecondary, marginBottom: 2 }]}>
                  {item.sender.fullName}
                  {item.isInternalNote ? " · internal note" : ""}
                </Text>
              ) : null}
              <Text style={[typography.body, { color: mine ? theme.primaryText : theme.textPrimary }]}>
                {item.body}
              </Text>
            </View>
          );
        }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ padding: spacing.lg, borderTopWidth: 1, borderTopColor: theme.border, gap: spacing.sm }}>
          {isStaff ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: internalNote }}
              onPress={() => setInternalNote((v) => !v)}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  borderWidth: 1.5,
                  borderColor: theme.border,
                  backgroundColor: internalNote ? theme.warning : "transparent",
                }}
              />
              <Text style={[typography.caption, { color: theme.textSecondary }]}>
                Internal note (hidden from client)
              </Text>
            </Pressable>
          ) : null}
          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" }}>
            <View style={{ flex: 1 }}>
              <TextField
                label=""
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a message…"
                multiline
              />
            </View>
            <View style={{ width: 90 }}>
              <Button
                label="Send"
                loading={sendMutation.isPending}
                disabled={draft.trim().length === 0 || !conversationId}
                onPress={() => sendMutation.mutate()}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
