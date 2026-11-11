import { View, Text, TextInput, StyleSheet, type TextInputProps } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { radii, spacing, typography } from "../theme/tokens";

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function TextField({ label, error, style, ...inputProps }: TextFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          {
            color: theme.textPrimary,
            borderColor: error ? theme.danger : theme.border,
            backgroundColor: theme.surface,
          },
          style,
        ]}
        accessibilityLabel={label}
        {...inputProps}
      />
      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { ...typography.caption, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...typography.body,
    minHeight: 48,
  },
  error: { ...typography.small, marginTop: spacing.xs },
});
