import { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { useAuthStore } from "../../../src/stores/auth-store";
import { apiRequest } from "../../../src/lib/api-client";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { colors, radii, spacing, typography } from "../../../src/theme/tokens";

const BUDGET_OPTIONS = [
  { label: "₹25,000 - ₹50,000", min: 25000, max: 50000 },
  { label: "₹50,000 - ₹1,00,000", min: 50000, max: 100000 },
  { label: "₹1,00,000 - ₹3,00,000", min: 100000, max: 300000 },
  { label: "₹3,00,000+", min: 300000, max: 1000000 },
];

const TIMELINE_OPTIONS = [
  "Urgent (< 2 weeks)",
  "1 Month",
  "2 - 3 Months",
  "Flexible / Long-term",
];

export default function NewEnquiryScreen() {
  const theme = useTheme();
  const { user, activeOrganizationId } = useAuthStore();

  const [title, setTitle] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [businessProblem, setBusinessProblem] = useState("");
  const [requirements, setRequirements] = useState("");
  const [selectedBudgetIndex, setSelectedBudgetIndex] = useState<number | null>(null);
  const [selectedTimeline, setSelectedTimeline] = useState<string>("");
  const [referenceLinks, setReferenceLinks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedEnquiryId, setSubmittedEnquiryId] = useState<string | null>(null);

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["catalogue-categories"],
    queryFn: () => apiRequest<{ id: string; name: string; slug: string }[]>("/api/v1/catalogue/categories"),
  });

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert("Title Required", "Please enter a project name or working title.");
      return;
    }
    if (!requirements.trim() || requirements.trim().length < 10) {
      Alert.alert("Details Required", "Please provide a description of requirements (at least 10 characters).");
      return;
    }
    if (!activeOrganizationId) {
      Alert.alert("Organization Required", "Please ensure your account has an active client organization.");
      return;
    }

    setIsSubmitting(true);
    try {
      const budget = selectedBudgetIndex !== null ? BUDGET_OPTIONS[selectedBudgetIndex] : undefined;

      const combinedNotes = [
        businessProblem.trim() ? `Business Problem:\n${businessProblem.trim()}` : "",
        `Requirements:\n${requirements.trim()}`,
        referenceLinks.trim() ? `References & Links:\n${referenceLinks.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const response = await apiRequest<{ id: string }>("/api/v1/enquiries", {
        method: "POST",
        body: {
          organizationId: activeOrganizationId,
          title: title.trim(),
          requirements: combinedNotes,
          budgetRangeMin: budget?.min,
          budgetRangeMax: budget?.max,
          expectedTimeline: selectedTimeline || undefined,
        },
      });

      setSubmittedEnquiryId(response.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit enquiry. Please try again.";
      Alert.alert("Submission Failed", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedEnquiryId) {
    return (
      <ScreenContainer>
        <View style={styles.successContainer}>
          <View style={styles.successIconCircle}>
            <Ionicons name="checkmark-done" size={40} color="#FFFFFF" />
          </View>
          <Text style={[typography.h1, { color: theme.textPrimary, textAlign: "center", marginTop: spacing.md }]}>
            Enquiry Received!
          </Text>
          <Text
            style={[
              typography.body,
              { color: theme.textSecondary, textAlign: "center", marginTop: spacing.sm, paddingHorizontal: 16 },
            ]}
          >
            Your requirement has been logged under ID #{submittedEnquiryId.slice(-6).toUpperCase()}. A KryptonIX Solution Architect is reviewing your scope and will prepare a tailored proposal.
          </Text>

          <Card style={styles.nextStepsCard}>
            <Text style={[typography.bodyStrong, { color: theme.textPrimary, marginBottom: spacing.xs }]}>
              What happens next?
            </Text>
            <View style={styles.stepItem}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[typography.caption, { color: theme.textPrimary, flex: 1 }]}>
                1. Initial technical feasibility & scope assessment.
              </Text>
            </View>
            <View style={styles.stepItem}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[typography.caption, { color: theme.textPrimary, flex: 1 }]}>
                2. Preparation of a detailed Quotation with milestone schedules.
              </Text>
            </View>
            <View style={styles.stepItem}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[typography.caption, { color: theme.textPrimary, flex: 1 }]}>
                3. In-app proposal notification for your review and approval.
              </Text>
            </View>
          </Card>

          <Button
            label="Return to Dashboard"
            onPress={() => router.replace("/(app)/dashboard" as Parameters<typeof router.replace>[0])}
            style={{ width: "100%", marginTop: spacing.lg }}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={[typography.h3, { color: theme.textPrimary }]}>Request Custom Quotation</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={[typography.caption, { color: theme.textSecondary, marginBottom: spacing.md }]}>
          Need custom architecture, bespoke software, or an enterprise scale solution? Share your project specifications below for a detailed proposal.
        </Text>

        <Card style={styles.formCard}>
          {/* Project Name */}
          <View style={styles.inputGroup}>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>Project / Solution Name *</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.textPrimary }]}
              placeholder="e.g. Multi-Vendor Fitness Marketplace"
              placeholderTextColor={theme.textSecondary}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Category Selector */}
          <View style={styles.inputGroup}>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>Primary Service Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
              {(categories ?? []).map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      isSelected && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}
                    onPress={() => setSelectedCategoryId(isSelected ? "" : cat.id)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected ? { color: "#FFFFFF" } : { color: theme.textSecondary },
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Business Problem */}
          <View style={styles.inputGroup}>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>Business Problem You Are Solving</Text>
            <TextInput
              style={[styles.textArea, { borderColor: theme.border, color: theme.textPrimary }]}
              placeholder="What manual process or operational bottleneck are you looking to solve?"
              placeholderTextColor={theme.textSecondary}
              value={businessProblem}
              onChangeText={setBusinessProblem}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Detailed Requirements */}
          <View style={styles.inputGroup}>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>Detailed Scope & Expected Features *</Text>
            <TextInput
              style={[styles.textArea, { borderColor: theme.border, color: theme.textPrimary, minHeight: 90 }]}
              placeholder="List specific screens, platform requirements, third-party integrations or user roles needed..."
              placeholderTextColor={theme.textSecondary}
              value={requirements}
              onChangeText={setRequirements}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Budget Range */}
          <View style={styles.inputGroup}>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>Approximate Budget Range (Optional)</Text>
            <View style={styles.budgetGrid}>
              {BUDGET_OPTIONS.map((opt, idx) => {
                const isSelected = selectedBudgetIndex === idx;
                return (
                  <Pressable
                    key={idx}
                    style={[
                      styles.budgetChip,
                      isSelected && { backgroundColor: colors.violet50, borderColor: theme.primary },
                    ]}
                    onPress={() => setSelectedBudgetIndex(isSelected ? null : idx)}
                  >
                    <Text
                      style={[
                        typography.small,
                        { fontWeight: "600" },
                        isSelected ? { color: theme.primary } : { color: theme.textPrimary },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Timeline */}
          <View style={styles.inputGroup}>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>Expected Timeline</Text>
            <View style={styles.timelineRow}>
              {TIMELINE_OPTIONS.map((opt) => {
                const isSelected = selectedTimeline === opt;
                return (
                  <Pressable
                    key={opt}
                    style={[
                      styles.timelineChip,
                      isSelected && { backgroundColor: colors.violet50, borderColor: theme.primary },
                    ]}
                    onPress={() => setSelectedTimeline(isSelected ? "" : opt)}
                  >
                    <Text
                      style={[
                        typography.small,
                        { fontWeight: "600" },
                        isSelected ? { color: theme.primary } : { color: theme.textSecondary },
                      ]}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Reference Links */}
          <View style={styles.inputGroup}>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>Reference Links / Competitor Examples</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.textPrimary }]}
              placeholder="https://example.com/app or Figma links"
              placeholderTextColor={theme.textSecondary}
              value={referenceLinks}
              onChangeText={setReferenceLinks}
              autoCapitalize="none"
            />
          </View>
        </Card>

        <Button
          label={isSubmitting ? "Submitting Requirement..." : "Submit Requirement"}
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={{ marginTop: spacing.lg }}
        />
        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  backButton: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  formCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  inputGroup: {
    gap: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: "top",
    minHeight: 70,
  },
  categoryChips: {
    gap: spacing.xs,
    paddingVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.neutral200,
  },
  categoryChipText: {
    ...typography.small,
    fontWeight: "600",
  },
  budgetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  budgetChip: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  timelineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  timelineChip: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: radii.full,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  nextStepsCard: {
    width: "100%",
    padding: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
