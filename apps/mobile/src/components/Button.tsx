import { Pressable, Text, ActivityIndicator, StyleSheet, type GestureResponderEvent } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { radii, spacing, typography } from "../theme/tokens";

interface ButtonProps {
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  fullWidth = true,
}: ButtonProps) {
  const theme = useTheme();

  const backgroundColor =
    variant === "primary"
      ? theme.primary
      : variant === "danger"
        ? theme.danger
        : variant === "secondary"
          ? theme.surface
          : "transparent";

  const textColor =
    variant === "primary" || variant === "danger" ? theme.primaryText : theme.textPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: variant === "secondary" || variant === "ghost" ? 1 : 0,
          borderColor: theme.border,
          width: fullWidth ? "100%" : undefined,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  label: {
    ...typography.bodyStrong,
  },
});
