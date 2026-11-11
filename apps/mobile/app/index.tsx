import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuthStore } from "../src/stores/auth-store";
import { useTheme } from "../src/theme/ThemeProvider";

// Splash → routing decision. Expo's native splash screen (app.json) shows
// first; this screen's only job is to decide where to send the user once
// auth state has hydrated from secure storage.
export default function SplashRouter() {
  const theme = useTheme();
  const { user, isHydrated } = useAuthStore();

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.background }}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/welcome" />;

  if (user.userType === "CLIENT" && !user.organizations?.some((o) => o.approved)) {
    return <Redirect href="/(auth)/pending-approval" />;
  }

  return <Redirect href="/(app)/dashboard" />;
}
