import { View, Text, Image, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { Button } from "../../src/components/Button";
import { useTheme } from "../../src/theme/ThemeProvider";
import { spacing, typography } from "../../src/theme/tokens";

export default function WelcomeScreen() {
  const theme = useTheme();

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.hero}>
        {/* Replace with the real KryptonIX logo asset once added to
            apps/mobile/assets/ — see PROGRESS.md */}
        <View style={[styles.logoPlaceholder, { backgroundColor: theme.primary }]}>
          <Text style={styles.logoText}>KX</Text>
        </View>
        <Text style={[typography.h1, { color: theme.textPrimary, textAlign: "center", marginTop: spacing.lg }]}>
          KryptonIX Client
        </Text>
        <Text
          style={[
            typography.body,
            { color: theme.textSecondary, textAlign: "center", marginTop: spacing.sm },
          ]}
        >
          Build Better. Grow Faster. Scale Smarter.{"\n"}
          Manage your entire project, quotes and payments with KryptonIX in one place.
        </Text>
      </View>

      <View style={{ gap: spacing.md }}>
        <Link href="/(auth)/login" asChild>
          <Button label="Sign In" />
        </Link>
        <Link href="/(auth)/register" asChild>
          <Button label="Create an Account" variant="secondary" />
        </Link>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: "space-between" },
  hero: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#fff", fontSize: 32, fontWeight: "800" },
});
