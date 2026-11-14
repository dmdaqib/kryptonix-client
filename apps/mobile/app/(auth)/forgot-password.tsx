import { useState } from "react";
import { Text } from "react-native";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { TextField } from "../../src/components/TextField";
import { Button } from "../../src/components/Button";
import { useTheme } from "../../src/theme/ThemeProvider";
import { spacing, typography } from "../../src/theme/tokens";
import { apiRequest, isApiError } from "../../src/lib/api-client";

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit() {
    setError(undefined);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      await apiRequest("/api/v1/auth/forgot-password", {
        method: "POST",
        body: { email: cleanEmail },
        auth: false,
      });
      setSent(true);
    } catch (err: unknown) {
      if (isApiError(err)) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to send reset request. Please check your connection.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer style={{ justifyContent: "center" }}>
      <Text style={[typography.h2, { color: theme.textPrimary, marginBottom: spacing.sm }]}>Reset your password</Text>

      {sent ? (
        <Text style={[typography.body, { color: theme.textSecondary }]}>
          If an account exists for that email, a reset link is on its way.
        </Text>
      ) : (
        <>
          <Text style={[typography.body, { color: theme.textSecondary, marginBottom: spacing.lg }]}>
            Enter your email and we'll send you a link to reset your password.
          </Text>
          <TextField
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {error ? <Text style={{ color: theme.danger, marginBottom: spacing.md }}>{error}</Text> : null}
          <Button label="Send Reset Link" onPress={onSubmit} loading={loading} />
        </>
      )}
    </ScreenContainer>
  );
}
