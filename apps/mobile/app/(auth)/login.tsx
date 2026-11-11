import { useState } from "react";
import { Text, Alert } from "react-native";
import { Link, router } from "expo-router";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { TextField } from "../../src/components/TextField";
import { Button } from "../../src/components/Button";
import { useAuthStore } from "../../src/stores/auth-store";
import { useTheme } from "../../src/theme/ThemeProvider";
import { spacing, typography } from "../../src/theme/tokens";
import { ApiError } from "../../src/lib/api-client";

export default function LoginScreen() {
  const theme = useTheme();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();

  async function onSubmit() {
    setError(undefined);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <ScreenContainer>
      <Text style={[typography.h2, { color: theme.textPrimary, marginBottom: spacing.lg }]}>Welcome back</Text>

      <TextField
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        testID="login-email"
      />
      <TextField
        label="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        testID="login-password"
      />

      {error ? <Text style={{ color: theme.danger, marginBottom: spacing.md }}>{error}</Text> : null}

      <Button label="Sign In" onPress={onSubmit} loading={isLoading} />

      <Link href="/(auth)/forgot-password" style={{ marginTop: spacing.lg, textAlign: "center" }}>
        <Text style={{ color: theme.primary }}>Forgot your password?</Text>
      </Link>
    </ScreenContainer>
  );
}
