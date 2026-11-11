import { Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { EmptyState } from "../../../src/components/EmptyState";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { typography } from "../../../src/theme/tokens";

// Placeholder detail screen: milestones, messaging and deliverable
// approval UI are specified (sections 11–14) and modeled in the database,
// but their screens are not yet built — tracked in PROGRESS.md under P3.
export default function ProjectDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ScreenContainer>
      <Text style={[typography.h2, { color: theme.textPrimary }]}>Project</Text>
      <EmptyState
        title="Project detail coming soon"
        description={`Milestones, messaging and deliverable approvals for project ${id} will appear here once P3 ships.`}
      />
    </ScreenContainer>
  );
}
