import { useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { TextField } from "../../src/components/TextField";
import { Button } from "../../src/components/Button";
import { useTheme } from "../../src/theme/ThemeProvider";
import { spacing, typography } from "../../src/theme/tokens";
import { apiRequest, ApiError } from "../../src/lib/api-client";

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit() {
    setError(undefined);
    setLoading(true);
    try {
      await apiRequest("/api/v1/auth/reset-password", {
        method: "POST",
        body: { token, newPassword },
        auth: false,
      });
      router.replace("/(auth)/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "This reset link is invalid or expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer style={{ justifyContent: "center" }}>
      <Text style={[typography.h2, { color: theme.textPrimary, marginBottom: spacing.lg }]}>Set a new password</Text>
      <TextField label="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
      {error ? <Text style={{ color: theme.danger, marginBottom: spacing.md }}>{error}</Text> : null}
      <Button label="Update Password" onPress={onSubmit} loading={loading} />
    </ScreenContainer>
  );
}
