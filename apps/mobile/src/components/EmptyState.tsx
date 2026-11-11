import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { spacing, typography } from "../theme/tokens";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[typography.h3, { color: theme.textPrimary, textAlign: "center" }]}>{title}</Text>
      {description ? (
        <Text
          style={[typography.body, { color: theme.textSecondary, textAlign: "center", marginTop: spacing.sm }]}
        >
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.lg, width: "100%" }}>
          <Button label={actionLabel} onPress={onAction} fullWidth={false} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
});
