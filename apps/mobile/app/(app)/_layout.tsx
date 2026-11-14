import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useTheme } from "../../src/theme/ThemeProvider";

function TabIcon({ label, focused, color }: { label: string; focused: boolean; color: string }) {
  return <Text style={{ color, fontSize: 20 }}>{label}</Text>;
}

export default function AppTabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Dashboard", tabBarIcon: ({ color, focused }) => <TabIcon label="🏠" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="services"
        options={{ title: "Services", tabBarIcon: ({ color, focused }) => <TabIcon label="🧩" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="projects"
        options={{ title: "Projects", tabBarIcon: ({ color, focused }) => <TabIcon label="📁" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="invoices"
        options={{ title: "Payments", tabBarIcon: ({ color, focused }) => <TabIcon label="💳" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color, focused }) => <TabIcon label="👤" color={color} focused={focused} /> }}
      />
      {/* Each of services/projects/invoices/tickets above is now its own
          folder with a _layout.tsx Stack, so its detail screens ([slug],
          [id], etc.) push/pop properly inside that tab instead of being
          registered as separate hidden tabs. tickets has no tab bar button
          of its own (opened via a link from elsewhere), same for
          notifications. */}
      <Tabs.Screen name="tickets" options={{ href: null }} />
      <Tabs.Screen name="notifications/index" options={{ href: null }} />
    </Tabs>
  );
}
