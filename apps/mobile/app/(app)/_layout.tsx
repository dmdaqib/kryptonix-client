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
        name="services/index"
        options={{ title: "Services", tabBarIcon: ({ color, focused }) => <TabIcon label="🧩" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="projects/index"
        options={{ title: "Projects", tabBarIcon: ({ color, focused }) => <TabIcon label="📁" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="invoices/index"
        options={{ title: "Payments", tabBarIcon: ({ color, focused }) => <TabIcon label="💳" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color, focused }) => <TabIcon label="👤" color={color} focused={focused} /> }}
      />
      {/* Detail routes render outside the tab bar but still live under
          (app) so they share auth guarding + the root QueryClient. */}
      <Tabs.Screen name="services/[slug]" options={{ href: null }} />
      <Tabs.Screen name="projects/[id]" options={{ href: null }} />
      <Tabs.Screen name="projects/[id]/messages" options={{ href: null }} />
      <Tabs.Screen name="invoices/[id]" options={{ href: null }} />
      <Tabs.Screen name="tickets/index" options={{ href: null }} />
      <Tabs.Screen name="tickets/[id]" options={{ href: null }} />
      <Tabs.Screen name="tickets/new" options={{ href: null }} />
      <Tabs.Screen name="notifications/index" options={{ href: null }} />
    </Tabs>
  );
}
