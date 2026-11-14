import { Stack } from "expo-router";

// Nests the services list and its detail screen in their own stack, inside
// the "Services" tab, instead of registering the detail screen as a sibling
// hidden tab — that sibling-tab pattern is what was causing router.push into
// services/[slug] to bounce back out instead of navigating forward.
export default function ServicesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
