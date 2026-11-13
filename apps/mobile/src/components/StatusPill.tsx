import { Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { radii, spacing, typography } from "../theme/tokens";

// Shared across invoices, projects, milestones and tickets so a status pill
// always looks and reads the same wherever it appears in the app.
const POSITIVE = new Set(["PAID", "COMPLETED", "APPROVED", "SUCCEEDED", "RESOLVED", "ACTIVE", "ACCEPTED"]);
const ATTENTION = new Set([
  "SENT",
  "PARTIALLY_PAID",
  "SUBMITTED_FOR_REVIEW",
  "UNDER_CLIENT_REVIEW",
  "AWAITING_CLIENT",
  "PENDING",
  "PENDING_APPROVAL",
  "IN_PROGRESS",
  "ASSIGNED",
]);
const NEGATIVE = new Set(["OVERDUE", "VOID", "FAILED", "CANCELLED", "REJECTED", "REVISION_REQUESTED", "URGENT"]);

function toLabel(status: string) {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const theme = useTheme();
  const color = POSITIVE.has(status)
    ? theme.success
    : NEGATIVE.has(status)
      ? theme.danger
      : ATTENTION.has(status)
        ? theme.warning
        : theme.textSecondary;

  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: `${color}1F`,
        borderRadius: radii.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
      }}
    >
      <Text style={[typography.small, { color, fontWeight: "700" }]}>{label ?? toLabel(status)}</Text>
    </View>
  );
}
