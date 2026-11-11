import { Text } from "react-native";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { Button } from "../../src/components/Button";
import { useAuthStore } from "../../src/stores/auth-store";
import { useTheme } from "../../src/theme/ThemeProvider";
import { spacing, typography } from "../../src/theme/tokens";

export default function PendingApprovalScreen() {
  const theme = useTheme();
  const logout = useAuthStore((s) => s.logout);

  return (
    <ScreenContainer style={{ justifyContent: "center" }}>
      <Text style={[typography.h2, { color: theme.textPrimary, textAlign: "center" }]}>
        Your account is under review
      </Text>
      <Text
        style={[typography.body, { color: theme.textSecondary, textAlign: "center", marginVertical: spacing.md }]}
      >
        Thanks for registering with KryptonIX. Our team is reviewing your business details — you'll get a
        notification the moment you're approved.
      </Text>
      <Button label="Sign Out" variant="secondary" onPress={logout} />
    </ScreenContainer>
  );
}
