import { useState } from "react";
import { ScrollView, Text, View, Alert } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Button } from "../../../src/components/Button";
import { TextField } from "../../../src/components/TextField";
import { useAuthStore } from "../../../src/stores/auth-store";
import { apiRequest, ApiError } from "../../../src/lib/api-client";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { spacing, typography, radii } from "../../../src/theme/tokens";

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
const CATEGORIES = ["billing", "technical", "general"] as const;

export default function NewTicketScreen() {
  const theme = useTheme();
  const { activeOrganizationId } = useAuthStore();

  const [category, setCategory] = useState<string>("general");
  const [priority, setPriority] = useState<string>("NORMAL");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/organizations/${activeOrganizationId}/tickets`, {
        method: "POST",
        body: { category, priority, subject: subject.trim(), description: description.trim() },
      }),
    onSuccess: () => {
      Alert.alert("Ticket raised", "Our support team will get back to you shortly.");
      router.back();
    },
    onError: (err) => Alert.alert("Couldn't raise ticket", err instanceof ApiError ? err.message : "Try again."),
  });

  function Chooser({ options, value, onChange }: { options: readonly string[]; value: string; onChange: (v: string) => void }) {
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md }}>
        {options.map((opt) => {
          const selected = opt === value;
          return (
            <Text
              key={opt}
              onPress={() => onChange(opt)}
              style={[
                typography.caption,
                {
                  color: selected ? theme.primaryText : theme.textPrimary,
                  backgroundColor: selected ? theme.primary : theme.surface,
                  borderRadius: radii.full,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs + 2,
                  borderWidth: selected ? 0 : 1,
                  borderColor: theme.border,
                },
              ]}
            >
              {opt}
            </Text>
          );
        })}
      </View>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[typography.h2, { color: theme.textPrimary, marginBottom: spacing.lg }]}>
          Raise a support ticket
        </Text>

        <Text style={[typography.caption, { color: theme.textSecondary, marginBottom: spacing.xs }]}>Category</Text>
        <Chooser options={CATEGORIES} value={category} onChange={setCategory} />

        <Text style={[typography.caption, { color: theme.textSecondary, marginBottom: spacing.xs }]}>Priority</Text>
        <Chooser options={PRIORITIES} value={priority} onChange={setPriority} />

        <TextField label="Subject" value={subject} onChangeText={setSubject} placeholder="Short summary" />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Tell us what's going on"
          multiline
          style={{ minHeight: 100 }}
        />

        <Button
          label="Submit ticket"
          loading={createMutation.isPending}
          disabled={subject.trim().length < 3 || description.trim().length < 10}
          onPress={() => createMutation.mutate()}
        />
      </ScrollView>
    </ScreenContainer>
  );
}
