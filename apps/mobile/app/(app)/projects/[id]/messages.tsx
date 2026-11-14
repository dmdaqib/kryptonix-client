import { useState } from "react";
import {
  FlatList,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../../../src/components/ScreenContainer";
import { Button } from "../../../../src/components/Button";
import { TextField } from "../../../../src/components/TextField";
import { useAuthStore } from "../../../../src/stores/auth-store";
import { apiRequest } from "../../../../src/lib/api-client";
import { useTheme } from "../../../../src/theme/ThemeProvider";
import { colors, spacing, radii, typography } from "../../../../src/theme/tokens";

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
    queryFn: () => apiRequest<{ id: string; title?: string }>(`/api/v1/projects/${id}/conversation`),
    enabled: Boolean(id),
  });

  const conversationId = conversation?.id;

  const { data: messages, isLoading } = useQuery({
    queryKey: ["conversation-messages", conversationId],
    queryFn: () => apiRequest<Message[]>(`/api/v1/conversations/${conversationId}/messages`),
    enabled: Boolean(conversationId),
    refetchInterval: 4000,
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
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[typography.h3, { color: theme.textPrimary }]} numberOfLines={1}>
            {conversation?.title ?? "Project Chat"}
          </Text>
          <Text style={[typography.small, { color: colors.success }]}>● Direct Team Channel</Text>
        </View>
      </View>

      {/* Messages Feed */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={messages ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
          inverted={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={40} color={theme.textSecondary} />
              <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 8, textAlign: "center" }]}>
                Welcome to your dedicated workspace chat. Send a message to communicate with the KryptonIX project team.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.sender.id === user?.id;
            return (
              <View
                style={[
                  styles.messageBubble,
                  mine ? styles.mineBubble : styles.theirBubble,
                  item.isInternalNote && styles.internalNoteBubble,
                  {
                    backgroundColor: item.isInternalNote
                      ? "#FEF3C7"
                      : mine
                        ? theme.primary
                        : theme.surface,
                  },
                ]}
              >
                {!mine ? (
                  <View style={styles.senderRow}>
                    <Text
                      style={[
                        typography.small,
                        {
                          color: item.isInternalNote ? "#B45309" : theme.primary,
                          fontWeight: "700",
                        },
                      ]}
                    >
                      {item.sender.fullName}
                      {item.isInternalNote ? " · INTERNAL STAFF NOTE" : ""}
                    </Text>
                  </View>
                ) : null}

                <Text
                  style={[
                    typography.body,
                    {
                      color: item.isInternalNote
                        ? "#92400E"
                        : mine
                          ? theme.primaryText
                          : theme.textPrimary,
                    },
                  ]}
                >
                  {item.body}
                </Text>

                <Text
                  style={[
                    typography.small,
                    {
                      alignSelf: "flex-end",
                      color: item.isInternalNote
                        ? "#B45309"
                        : mine
                          ? "rgba(255,255,255,0.7)"
                          : theme.textSecondary,
                      fontSize: 10,
                      marginTop: 2,
                    },
                  ]}
                >
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            );
          }}
        />
      )}

      {/* Input Composer */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.composerBox, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
          {isStaff && (
            <Pressable
              onPress={() => setInternalNote((v) => !v)}
              style={[
                styles.internalToggle,
                internalNote && { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" },
              ]}
            >
              <Ionicons
                name={internalNote ? "eye-off" : "eye-outline"}
                size={16}
                color={internalNote ? "#B45309" : theme.textSecondary}
              />
              <Text
                style={[
                  typography.small,
                  { color: internalNote ? "#B45309" : theme.textSecondary, fontWeight: "600" },
                ]}
              >
                {internalNote ? "Internal staff note (hidden from client)" : "Public client reply"}
              </Text>
            </Pressable>
          )}

          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <TextField
                value={draft}
                onChangeText={setDraft}
                placeholder={internalNote ? "Write private staff note..." : "Type project message..."}
              />
            </View>
            <Button
              label="Send"
              size="sm"
              loading={sendMutation.isPending}
              disabled={draft.trim().length === 0}
              onPress={() => sendMutation.mutate()}
              style={{ minWidth: 70 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 4,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    paddingHorizontal: spacing.lg,
  },
  messageBubble: {
    maxWidth: "84%",
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  mineBubble: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 2,
  },
  theirBubble: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 2,
  },
  internalNoteBubble: {
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  senderRow: {
    marginBottom: 2,
  },
  composerBox: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  internalToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.neutral200,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
