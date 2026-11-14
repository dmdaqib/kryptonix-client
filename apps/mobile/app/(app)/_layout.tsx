import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function AppTabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="services/index"
        options={{
          title: "Services",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "grid" : "grid-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="projects/index"
        options={{
          title: "Projects",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "briefcase" : "briefcase-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="invoices/index"
        options={{
          title: "Billing",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "receipt" : "receipt-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
          ),
        }}
      />

      {/* Detail & modal routes render outside the tab bar */}
      <Tabs.Screen name="services/[slug]" options={{ href: null }} />
      <Tabs.Screen name="services/search" options={{ href: null }} />
      <Tabs.Screen name="cart/index" options={{ href: null }} />
      <Tabs.Screen name="enquiry/new" options={{ href: null }} />
      <Tabs.Screen name="quotes/index" options={{ href: null }} />
      <Tabs.Screen name="quotes/[id]" options={{ href: null }} />
      <Tabs.Screen name="staff/index" options={{ href: null }} />
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
