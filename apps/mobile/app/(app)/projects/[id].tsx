import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Alert,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { TextField } from "../../../src/components/TextField";
import { StatusPill } from "../../../src/components/StatusPill";
import { useAuthStore } from "../../../src/stores/auth-store";
import { apiRequest, ApiError } from "../../../src/lib/api-client";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { colors, spacing, radii, typography } from "../../../src/theme/tokens";

interface Approval {
  id: string;
  decision: "PENDING" | "APPROVED" | "REVISION_REQUESTED";
  feedback: string | null;
  decidedAt: string;
}

interface Deliverable {
  id: string;
  version: number;
  submittedAt: string;
  file: { id: string; originalName: string };
  approvals: Approval[];
}

interface Milestone {
  id: string;
  name: string;
  description: string | null;
  status: string;
  dueDate?: string | null;
  requiresClientApproval: boolean;
  deliverables: Deliverable[];
}

interface ProjectUpdate {
  id: string;
  body: string;
  createdAt: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate?: string | null;
  expectedDeliveryDate?: string | null;
  milestones: Milestone[];
  updates: ProjectUpdate[];
}

export default function ProjectDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isStaff = user?.userType === "STAFF";

  const [revisingDeliverableId, setRevisingDeliverableId] = useState<string | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [submittingToMilestoneId, setSubmittingToMilestoneId] = useState<string | null>(null);
  const [deliverableFileName, setDeliverableFileName] = useState("");

  const { data: project, isLoading, refetch } = useQuery({
    queryKey: ["project", id],
    queryFn: () => apiRequest<ProjectDetail>(`/api/v1/projects/${id}`),
    enabled: Boolean(id),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["project", id] });

  const approveMutation = useMutation({
    mutationFn: (deliverableId: string) =>
      apiRequest(`/api/v1/deliverables/${deliverableId}/approve`, { method: "POST" }),
    onSuccess: () => {
      Alert.alert("Deliverable Approved", "Milestone completed! KryptonIX staff have been notified.");
      invalidate();
    },
    onError: (err) => Alert.alert("Couldn't approve", err instanceof ApiError ? err.message : "Try again."),
  });

  const requestRevisionMutation = useMutation({
    mutationFn: ({ deliverableId, notes }: { deliverableId: string; notes: string }) =>
      apiRequest(`/api/v1/deliverables/${deliverableId}/request-revision`, { method: "POST", body: { notes } }),
    onSuccess: () => {
      setRevisingDeliverableId(null);
      setRevisionNotes("");
      Alert.alert("Changes Requested", "Feedback submitted to the development team.");
      invalidate();
    },
    onError: (err) => Alert.alert("Couldn't send", err instanceof ApiError ? err.message : "Try again."),
  });

  const createMilestoneMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest(`/api/v1/projects/${id}/milestones`, {
        method: "POST",
        body: { name, requiresClientApproval: true },
      }),
    onSuccess: () => {
      setAddingMilestone(false);
      setNewMilestoneName("");
      invalidate();
    },
    onError: (err) => Alert.alert("Couldn't create milestone", err instanceof ApiError ? err.message : "Try again."),
  });

  const submitDeliverableMutation = useMutation({
    mutationFn: async ({ milestoneId, fileName }: { milestoneId: string; fileName: string }) => {
      const file = await apiRequest<{ id: string }>(`/api/v1/projects/${id}/files`, {
        method: "POST",
        body: {
          category: "deliverable",
          originalName: fileName,
          storageKey: `manual/${Date.now()}-${fileName}`,
          mimeType: "application/octet-stream",
          sizeBytes: 1,
        },
      });
      await apiRequest(`/api/v1/milestones/${milestoneId}/deliverables`, {
        method: "POST",
        body: { fileId: file.id },
      });
    },
    onSuccess: () => {
      setSubmittingToMilestoneId(null);
      setDeliverableFileName("");
      Alert.alert("Deliverable Submitted", "Submitted for client review.");
      invalidate();
    },
    onError: (err) => Alert.alert("Couldn't submit", err instanceof ApiError ? err.message : "Try again."),
  });

  if (isLoading || !project) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </ScreenContainer>
    );
  }

  const milestones = project.milestones ?? [];
  const completedCount = milestones.filter((m) => m.status === "APPROVED").length;
  const progressPercent = Math.round((completedCount / Math.max(1, milestones.length)) * 100);

  return (
    <ScreenContainer>
      {/* Top Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={[typography.h3, { color: theme.textPrimary, flex: 1, marginLeft: 8 }]} numberOfLines={1}>
          {project.name}
        </Text>
        <Pressable
          style={styles.chatIconBtn}
          onPress={() => router.push(`/(app)/projects/${id}/messages` as Parameters<typeof router.push>[0])}
          hitSlop={8}
        >
          <Ionicons name="chatbubbles" size={22} color={colors.violet700} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Project Overview Card */}
        <Card style={styles.overviewCard}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[typography.caption, { color: colors.violet700, fontWeight: "700" }]}>
                PROJECT WORKSPACE
              </Text>
              <Text style={[typography.h2, { color: theme.textPrimary, marginTop: 2 }]}>
                {project.name}
              </Text>
            </View>
            <StatusPill status={project.status} />
          </View>

          {project.description && (
            <Text style={[typography.caption, { color: theme.textSecondary, marginTop: spacing.xs, lineHeight: 18 }]}>
              {project.description}
            </Text>
          )}

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={[typography.caption, { color: theme.textPrimary, fontWeight: "600" }]}>
                Overall Progress ({progressPercent}%)
              </Text>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>
                {completedCount} of {milestones.length} Milestones
              </Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.max(6, progressPercent)}%`, backgroundColor: colors.success },
                ]}
              />
            </View>
          </View>

          {/* Quick Chat CTA */}
          <Button
            label="Open Team Workspace Chat"
            variant="outline"
            onPress={() => router.push(`/(app)/projects/${id}/messages` as Parameters<typeof router.push>[0])}
            style={{ marginTop: spacing.sm }}
          />
        </Card>

        {/* Milestones Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.h3, { color: theme.textPrimary }]}>Milestones & Deliverables</Text>
          {isStaff ? (
            <Pressable onPress={() => setAddingMilestone((v) => !v)} hitSlop={8}>
              <Text style={[typography.caption, { color: theme.primary, fontWeight: "700" }]}>
                {addingMilestone ? "Cancel" : "+ Add Milestone"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {addingMilestone && (
          <Card style={{ marginBottom: spacing.md, padding: spacing.md }}>
            <TextField
              label="Milestone name"
              value={newMilestoneName}
              onChangeText={setNewMilestoneName}
              placeholder="e.g. Design Wireframes & API Spec"
            />
            <Button
              label="Create milestone"
              loading={createMilestoneMutation.isPending}
              disabled={newMilestoneName.trim().length === 0}
              onPress={() => createMilestoneMutation.mutate(newMilestoneName.trim())}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        )}

        {/* Milestones List */}
        {milestones.length === 0 ? (
          <Card style={{ padding: spacing.md }}>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>
              No milestones created yet. Milestones will appear as the project is scheduled.
            </Text>
          </Card>
        ) : (
          <View style={styles.milestonesList}>
            {milestones.map((milestone, idx) => {
              const latestDeliverable = milestone.deliverables[0];
              const pendingApproval =
                !isStaff &&
                milestone.requiresClientApproval &&
                milestone.status === "SUBMITTED_FOR_REVIEW" &&
                latestDeliverable;

              return (
                <Card key={milestone.id} style={styles.milestoneCard}>
                  <View style={styles.milestoneHeader}>
                    <View style={styles.milestoneIndexBadge}>
                      <Text style={styles.milestoneIndexText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                        {milestone.name}
                      </Text>
                      {milestone.dueDate && (
                        <Text style={[typography.small, { color: theme.textSecondary }]}>
                          Target Date: {new Date(milestone.dueDate).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                    <StatusPill status={milestone.status} />
                  </View>

                  {milestone.description && (
                    <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 4 }]}>
                      {milestone.description}
                    </Text>
                  )}

                  {/* Deliverable info */}
                  {latestDeliverable && (
                    <View style={styles.deliverableBox}>
                      <Ionicons name="document-attach" size={18} color={theme.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.caption, { color: theme.textPrimary, fontWeight: "600" }]}>
                          Deliverable: {latestDeliverable.file.originalName} (v{latestDeliverable.version})
                        </Text>
                        <Text style={[typography.small, { color: theme.textSecondary }]}>
                          Submitted {new Date(latestDeliverable.submittedAt).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Client Approval or Revision UI */}
                  {pendingApproval ? (
                    revisingDeliverableId === latestDeliverable.id ? (
                      <View style={styles.revisionBox}>
                        <TextField
                          label="Describe Changes Required"
                          value={revisionNotes}
                          onChangeText={setRevisionNotes}
                          multiline
                          placeholder="What revisions or updates are needed before sign-off?"
                        />
                        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                          <Button
                            label="Submit Changes"
                            size="sm"
                            loading={requestRevisionMutation.isPending}
                            disabled={revisionNotes.trim().length < 3}
                            onPress={() =>
                              requestRevisionMutation.mutate({
                                deliverableId: latestDeliverable.id,
                                notes: revisionNotes.trim(),
                              })
                            }
                            style={{ flex: 1 }}
                          />
                          <Button
                            label="Cancel"
                            variant="secondary"
                            size="sm"
                            onPress={() => setRevisingDeliverableId(null)}
                            style={{ flex: 1 }}
                          />
                        </View>
                      </View>
                    ) : (
                      <View style={styles.approvalActionsRow}>
                        <Button
                          label="Approve Deliverable"
                          size="sm"
                          loading={approveMutation.isPending}
                          onPress={() => approveMutation.mutate(latestDeliverable.id)}
                          style={{ flex: 1 }}
                        />
                        <Button
                          label="Request Changes"
                          variant="outline"
                          size="sm"
                          onPress={() => setRevisingDeliverableId(latestDeliverable.id)}
                          style={{ flex: 1 }}
                        />
                      </View>
                    )
                  ) : null}

                  {/* Staff Deliverable Submission UI */}
                  {isStaff && (
                    submittingToMilestoneId === milestone.id ? (
                      <View style={styles.revisionBox}>
                        <TextField
                          label="Deliverable file or release name"
                          value={deliverableFileName}
                          onChangeText={setDeliverableFileName}
                          placeholder="e.g. kryptonix-mvp-release-v1.zip"
                        />
                        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                          <Button
                            label="Submit to Client"
                            size="sm"
                            loading={submitDeliverableMutation.isPending}
                            disabled={deliverableFileName.trim().length === 0}
                            onPress={() =>
                              submitDeliverableMutation.mutate({
                                milestoneId: milestone.id,
                                fileName: deliverableFileName.trim(),
                              })
                            }
                            style={{ flex: 1 }}
                          />
                          <Button
                            label="Cancel"
                            variant="secondary"
                            size="sm"
                            onPress={() => setSubmittingToMilestoneId(null)}
                            style={{ flex: 1 }}
                          />
                        </View>
                      </View>
                    ) : (
                      <View style={{ marginTop: spacing.sm }}>
                        <Button
                          label="+ Submit Deliverable"
                          variant="ghost"
                          size="sm"
                          onPress={() => setSubmittingToMilestoneId(milestone.id)}
                        />
                      </View>
                    )
                  )}
                </Card>
              );
            })}
          </View>
        )}

        {/* Project Updates Timeline */}
        {project.updates && project.updates.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[typography.h3, { color: theme.textPrimary, marginBottom: spacing.sm }]}>
              Recent Activity & Updates
            </Text>
            {project.updates.map((update) => (
              <Card key={update.id} style={{ marginBottom: spacing.sm, padding: spacing.md }}>
                <Text style={[typography.body, { color: theme.textPrimary }]}>{update.body}</Text>
                <Text style={[typography.small, { color: theme.textSecondary, marginTop: 4 }]}>
                  {new Date(update.createdAt).toLocaleString()}
                </Text>
              </Card>
            ))}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  backButton: {
    padding: 4,
  },
  chatIconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.violet50,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  overviewCard: {
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  progressSection: {
    marginTop: spacing.md,
  },
  progressLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: colors.neutral200,
    borderRadius: radii.full,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 8,
    borderRadius: radii.full,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  milestonesList: {
    gap: spacing.sm,
  },
  milestoneCard: {
    padding: spacing.md,
  },
  milestoneHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  milestoneIndexBadge: {
    width: 24,
    height: 24,
    borderRadius: radii.full,
    backgroundColor: colors.violet100,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginTop: 2,
  },
  milestoneIndexText: {
    ...typography.small,
    color: colors.violet700,
    fontWeight: "700",
  },
  deliverableBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.violet50,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  approvalActionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  revisionBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.neutral50,
    borderRadius: radii.sm,
  },
});
