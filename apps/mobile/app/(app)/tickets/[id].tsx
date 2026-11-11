import { useState } from "react";
import { ScrollView, Text, View, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { TextField } from "../../../src/components/TextField";
import { useAuthStore } from "../../../src/stores/auth-store";
import { apiRequest, ApiError } from "../../../src/lib/api-client";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { spacing, typography } from "../../../src/theme/tokens";

interface TicketMessage {
  id: string;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
  authorId: string;
}

interface TicketDetail {
  id: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  assignedToUserId: string | null;
  messages: TicketMessage[];
}

export default function TicketDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isStaff = user?.userType === "STAFF";

  const [reply, setReply] = useState("");

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => apiRequest<TicketDetail>(`/api/v1/tickets/${id}`),
    enabled: Boolean(id),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ticket", id] });

  const replyMutation = useMutation({
    mutationFn: () => apiRequest(`/api/v1/tickets/${id}/messages`, { method: "POST", body: { body: reply.trim() } }),
    onSuccess: () => {
      setReply("");
      invalidate();
    },
    onError: (err) => Alert.alert("Couldn't send", err instanceof ApiError ? err.message : "Try again."),
  });

  const assignToSelfMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/tickets/${id}/assign`, { method: "POST", body: { assignedToUserId: user?.id } }),
    onSuccess: invalidate,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => apiRequest(`/api/v1/tickets/${id}/status`, { method: "POST", body: { status } }),
    onSuccess: invalidate,
  });

  if (isLoading || !ticket) {
    return (
      <ScreenContainer>
        <Text style={[typography.body, { color: theme.textSecondary }]}>Loading ticket…</Text>
      </ScreenContainer>
    );
  }

  const canReply = ticket.status !== "CLOSED";

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[typography.h2, { color: theme.textPrimary }]}>{ticket.subject}</Text>
        <Text style={[typography.caption, { color: theme.textSecondary, marginBottom: spacing.md }]}>
          {ticket.category} · {ticket.priority} · {ticket.status}
        </Text>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.body, { color: theme.textPrimary }]}>{ticket.description}</Text>
        </Card>

        {isStaff ? (
          <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
            {!ticket.assignedToUserId || ticket.assignedToUserId !== user?.id ? (
              <View style={{ flex: 1 }}>
                <Button label="Assign to me" variant="secondary" onPress={() => assignToSelfMutation.mutate()} />
              </View>
            ) : null}
            {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" ? (
              <View style={{ flex: 1 }}>
                <Button label="Mark resolved" variant="secondary" onPress={() => statusMutation.mutate("RESOLVED")} />
              </View>
            ) : null}
            {ticket.status !== "CLOSED" ? (
              <View style={{ flex: 1 }}>
                <Button label="Close" variant="danger" onPress={() => statusMutation.mutate("CLOSED")} />
              </View>
            ) : null}
          </View>
        ) : null}

        {ticket.messages.map((message) => {
          const mine = message.authorId === user?.id;
          return (
            <Card
              key={message.id}
              style={{
                marginBottom: spacing.sm,
                backgroundColor: message.isInternalNote ? `${theme.warning}22` : theme.card,
              }}
            >
              <Text style={[typography.body, { color: theme.textPrimary }]}>{message.body}</Text>
              <Text style={[typography.small, { color: theme.textSecondary, marginTop: spacing.xs }]}>
                {mine ? "You" : isStaff ? "Client" : "Support"} · {new Date(message.createdAt).toLocaleString()}
                {message.isInternalNote ? " · internal note" : ""}
              </Text>
            </Card>
          );
        })}

        {canReply ? (
          <View style={{ marginTop: spacing.md }}>
            <TextField label="Reply" value={reply} onChangeText={setReply} placeholder="Type your reply…" multiline />
            <Button
              label="Send reply"
              loading={replyMutation.isPending}
              disabled={reply.trim().length === 0}
              onPress={() => replyMutation.mutate()}
            />
          </View>
        ) : (
          <Text style={[typography.caption, { color: theme.textSecondary, textAlign: "center", marginTop: spacing.md }]}>
            This ticket is closed.
          </Text>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
