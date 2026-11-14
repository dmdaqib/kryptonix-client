import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { radii, spacing, typography } from "../theme/tokens";

interface ButtonProps {
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  fullWidth = true,
  style,
}: ButtonProps) {
  const theme = useTheme();

  const isOutline = variant === "outline";
  const backgroundColor =
    variant === "primary"
      ? theme.primary
      : variant === "danger"
        ? theme.danger
        : variant === "secondary"
          ? theme.surface
          : "transparent";

  const textColor =
    variant === "primary" || variant === "danger"
      ? theme.primaryText
      : isOutline
        ? theme.primary
        : theme.textPrimary;

  const paddingVertical = size === "sm" ? 8 : size === "lg" ? spacing.lg : spacing.md;
  const paddingHorizontal = size === "sm" ? 12 : size === "lg" ? spacing.xl : spacing.lg;
  const minHeight = size === "sm" ? 36 : size === "lg" ? 54 : 48;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor,
          paddingVertical,
          paddingHorizontal,
          minHeight,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: variant === "secondary" || variant === "ghost" || isOutline ? 1 : 0,
          borderColor: isOutline ? theme.primary : theme.border,
          width: fullWidth && !style ? "100%" : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor, fontSize: size === "sm" ? 13 : 15 }]}>
          {label}
        </Text>
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
