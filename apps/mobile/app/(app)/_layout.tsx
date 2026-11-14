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
        name="services"
        options={{
          title: "Services",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "grid" : "grid-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: "Projects",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "briefcase" : "briefcase-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="invoices"
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

      {/* services/, projects/, invoices/, tickets/ and quotes/ each have
          their own _layout.tsx Stack (see those folders), so their
          list -> detail navigation (services/[slug], projects/[id],
          invoices/[id], tickets/[id], quotes/[id], services/search, etc.)
          pushes and pops properly within that tab.
          Registering a *dynamic* route like services/[slug] as its own
          flat sibling hidden tab (the previous structure here) is fragile:
          a bottom-tabs navigator switches between sibling tabs rather than
          pushing a real stack entry, and a dynamic param can fail to
          resolve on that switch and silently fall back to the first tab
          (Home) — which is exactly what tapping into a service was doing
          before this was nested into a real stack. cart, enquiry and staff
          are single leaf screens with no detail child, so they're fine to
          stay as flat hidden tabs. */}
      <Tabs.Screen name="cart/index" options={{ href: null }} />
      <Tabs.Screen name="enquiry/new" options={{ href: null }} />
      <Tabs.Screen name="quotes" options={{ href: null }} />
      <Tabs.Screen name="staff/index" options={{ href: null }} />
      <Tabs.Screen name="tickets" options={{ href: null }} />
      <Tabs.Screen name="notifications/index" options={{ href: null }} />
    </Tabs>
  );
}
