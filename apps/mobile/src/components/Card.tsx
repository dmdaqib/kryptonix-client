import React, { forwardRef } from "react";
import { View, type ViewProps, StyleSheet } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { radii, spacing } from "../theme/tokens";

export const Card = forwardRef<View, ViewProps>(function Card({ style, ...props }, ref) {
  const theme = useTheme();
  return (
    <View
      ref={ref}
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        style,
      ]}
      {...props}
    />
  );
});

Card.displayName = "Card";

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    // Subtle elevation — "premium, minimal" per the design brief, not a
    // heavy drop shadow.
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
});
