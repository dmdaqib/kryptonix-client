import { Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { useAuthStore } from "../../src/stores/auth-store";
import { useTheme } from "../../src/theme/ThemeProvider";
import { spacing, typography } from "../../src/theme/tokens";

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, logout } = useAuthStore();

  return (
    <ScreenContainer>
      <Text style={[typography.h2, { color: theme.textPrimary, marginBottom: spacing.md }]}>Profile</Text>

      <Card style={{ marginBottom: spacing.md }}>
        <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{user?.fullName}</Text>
        <Text style={[typography.caption, { color: theme.textSecondary }]}>{user?.email}</Text>
      </Card>

      {user?.organizations?.map((org) => (
        <Card key={org.id} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={[typography.body, { color: theme.textPrimary }]}>{org.name}</Text>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>{org.role}</Text>
          </View>
        </Card>
      ))}

      <Pressable onPress={() => router.push("/(app)/notifications")}>
        <Card style={{ marginBottom: spacing.sm }}>
          <Text style={[typography.body, { color: theme.textPrimary }]}>Notifications</Text>
        </Card>
      </Pressable>
      <Pressable onPress={() => router.push("/(app)/tickets")}>
        <Card style={{ marginBottom: spacing.sm }}>
          <Text style={[typography.body, { color: theme.textPrimary }]}>Support tickets</Text>
        </Card>
      </Pressable>

      <View style={{ marginTop: spacing.lg }}>
        <Button label="Sign Out" variant="secondary" onPress={logout} />
      </View>
    </ScreenContainer>
  );
}
