import { useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { Button } from "../../src/components/Button";
import { useTheme } from "../../src/theme/ThemeProvider";
import { spacing, typography } from "../../src/theme/tokens";

// The verification link is opened from the user's email client (deep-links
// back into this app via the `kryptonixclient://verify-email?token=...`
// scheme — wired through expo-linking once a verify-token deep link
// handler is added). This screen is the "check your inbox" holding screen
// shown right after registration.
export default function VerifyEmailScreen() {
  const theme = useTheme();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [resent, setResent] = useState(false);

  return (
    <ScreenContainer style={{ justifyContent: "center" }}>
      <Text style={[typography.h2, { color: theme.textPrimary, textAlign: "center" }]}>Check your email</Text>
      <Text
        style={[typography.body, { color: theme.textSecondary, textAlign: "center", marginVertical: spacing.md }]}
      >
        We sent a verification link to {"\n"}
        <Text style={{ color: theme.textPrimary }}>{email}</Text>
      </Text>

      <Button
        label={resent ? "Link sent again" : "Resend email"}
        variant="secondary"
        onPress={() => setResent(true)}
      />
      <Button label="Back to Sign In" variant="ghost" onPress={() => router.replace("/(auth)/login")} />
    </ScreenContainer>
  );
}
