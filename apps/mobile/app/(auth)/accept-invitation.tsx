import { useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { TextField } from "../../src/components/TextField";
import { Button } from "../../src/components/Button";
import { useTheme } from "../../src/theme/ThemeProvider";
import { spacing, typography } from "../../src/theme/tokens";
import { apiRequest, ApiError } from "../../src/lib/api-client";

// Deep link target for invitation emails:
// kryptonixclient://accept-invitation?token=...
export default function AcceptInvitationScreen() {
  const theme = useTheme();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit() {
    setError(undefined);
    setLoading(true);
    try {
      await apiRequest("/api/v1/invitations/accept", {
        method: "POST",
        body: { token, fullName, password },
        auth: false,
      });
      router.replace("/(auth)/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not accept this invitation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer style={{ justifyContent: "center" }}>
      <Text style={[typography.h2, { color: theme.textPrimary, marginBottom: spacing.lg }]}>
        You've been invited
      </Text>
      <TextField label="Full name" value={fullName} onChangeText={setFullName} />
      <TextField label="Create a password" secureTextEntry value={password} onChangeText={setPassword} />
      {error ? <Text style={{ color: theme.danger, marginBottom: spacing.md }}>{error}</Text> : null}
      <Button label="Join Organization" onPress={onSubmit} loading={loading} />
    </ScreenContainer>
  );
}
