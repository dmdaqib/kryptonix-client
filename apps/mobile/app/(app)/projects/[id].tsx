import { useState } from "react";
import { ScrollView, Text, View, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { TextField } from "../../../src/components/TextField";
import { useAuthStore } from "../../../src/stores/auth-store";
import { apiRequest, ApiError } from "../../../src/lib/api-client";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { spacing, radii, typography } from "../../../src/theme/tokens";

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
  milestones: Milestone[];
  updates: ProjectUpdate[];
}

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  PLANNING: "Planning",
  IN_PROGRESS: "In progress",
  UNDER_CLIENT_REVIEW: "Under your review",
  REVISION_REQUIRED: "Revision required",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  SUBMITTED_FOR_REVIEW: "Awaiting your review",
  APPROVED: "Approved",
  REVISION_REQUESTED: "Changes requested",
};

function StatusPill({ status }: { status: string }) {
  const theme = useTheme();
  const positive = status === "COMPLETED" || status === "APPROVED";
  const attention = status === "SUBMITTED_FOR_REVIEW" || status === "UNDER_CLIENT_REVIEW";
  const color = positive ? theme.success : attention ? theme.warning : theme.textSecondary;
  return (
    <View style={{ backgroundColor: `${color}22`, borderRadius: radii.full, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
      <Text style={[typography.small, { color, fontWeight: "700" }]}>{STATUS_LABELS[status] ?? status}</Text>
    </View>
  );
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

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => apiRequest<ProjectDetail>(`/api/v1/projects/${id}`),
    enabled: Boolean(id),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["project", id] });

  const approveMutation = useMutation({
    mutationFn: (deliverableId: string) =>
      apiRequest(`/api/v1/deliverables/${deliverableId}/approve`, { method: "POST" }),
    onSuccess: invalidate,
    onError: (err) => Alert.alert("Couldn't approve", err instanceof ApiError ? err.message : "Try again."),
  });

  const requestRevisionMutation = useMutation({
    mutationFn: ({ deliverableId, notes }: { deliverableId: string; notes: string }) =>
      apiRequest(`/api/v1/deliverables/${deliverableId}/request-revision`, { method: "POST", body: { notes } }),
    onSuccess: () => {
      setRevisingDeliverableId(null);
      setRevisionNotes("");
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
      // No real object-storage provider is wired up in this build (see
      // PROGRESS.md) — this registers file metadata directly rather than
      // going through a presigned upload, which is the one piece a real
      // deployment adds before this screen touches real files.
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
      invalidate();
    },
    onError: (err) => Alert.alert("Couldn't submit", err instanceof ApiError ? err.message : "Try again."),
  });

  if (isLoading || !project) {
    return (
      <ScreenContainer>
        <Text style={[typography.body, { color: theme.textSecondary }]}>Loading project…</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Text style={[typography.h2, { color: theme.textPrimary, flex: 1 }]}>{project.name}</Text>
          <StatusPill status={project.status} />
        </View>
        {project.description ? (
          <Text style={[typography.body, { color: theme.textSecondary, marginTop: spacing.xs }]}>
            {project.description}
          </Text>
        ) : null}

        <View style={{ marginTop: spacing.md, marginBottom: spacing.lg }}>
          <Button
            label="Open project chat"
            variant="secondary"
            onPress={() => router.push(`/(app)/projects/${id}/messages`)}
          />
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
          <Text style={[typography.h3, { color: theme.textPrimary }]}>Milestones</Text>
          {isStaff ? (
            <Button
              label={addingMilestone ? "Cancel" : "+ Add"}
              variant="ghost"
              fullWidth={false}
              onPress={() => setAddingMilestone((v) => !v)}
            />
          ) : null}
        </View>

        {addingMilestone ? (
          <Card style={{ marginBottom: spacing.md }}>
            <TextField
              label="Milestone name"
              value={newMilestoneName}
              onChangeText={setNewMilestoneName}
              placeholder="e.g. Homepage design"
            />
            <Button
              label="Create milestone"
              loading={createMilestoneMutation.isPending}
              disabled={newMilestoneName.trim().length === 0}
              onPress={() => createMilestoneMutation.mutate(newMilestoneName.trim())}
            />
          </Card>
        ) : null}

        {project.milestones.length === 0 ? (
          <Text style={[typography.caption, { color: theme.textSecondary, marginBottom: spacing.lg }]}>
            No milestones yet.
          </Text>
        ) : (
          project.milestones.map((milestone) => {
            const latestDeliverable = milestone.deliverables[0];
            const pendingApproval =
              !isStaff &&
              milestone.requiresClientApproval &&
              milestone.status === "SUBMITTED_FOR_REVIEW" &&
              latestDeliverable;

            return (
              <Card key={milestone.id} style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={[typography.bodyStrong, { color: theme.textPrimary, flex: 1 }]}>{milestone.name}</Text>
                  <StatusPill status={milestone.status} />
                </View>

                {latestDeliverable ? (
                  <Text style={[typography.caption, { color: theme.textSecondary, marginTop: spacing.xs }]}>
                    Latest: {latestDeliverable.file.originalName} (v{latestDeliverable.version})
                  </Text>
                ) : null}

                {pendingApproval ? (
                  revisingDeliverableId === latestDeliverable.id ? (
                    <View style={{ marginTop: spacing.sm }}>
                      <TextField
                        label="What needs to change?"
                        value={revisionNotes}
                        onChangeText={setRevisionNotes}
                        multiline
                        placeholder="Describe the changes you'd like"
                      />
                      <View style={{ flexDirection: "row", gap: spacing.sm }}>
                        <View style={{ flex: 1 }}>
                          <Button
                            label="Send"
                            loading={requestRevisionMutation.isPending}
                            disabled={revisionNotes.trim().length < 3}
                            onPress={() =>
                              requestRevisionMutation.mutate({
                                deliverableId: latestDeliverable.id,
                                notes: revisionNotes.trim(),
                              })
                            }
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Button
                            label="Cancel"
                            variant="secondary"
                            onPress={() => setRevisingDeliverableId(null)}
                          />
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                      <View style={{ flex: 1 }}>
                        <Button
                          label="Approve"
                          loading={approveMutation.isPending}
                          onPress={() => approveMutation.mutate(latestDeliverable.id)}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          label="Request changes"
                          variant="secondary"
                          onPress={() => setRevisingDeliverableId(latestDeliverable.id)}
                        />
                      </View>
                    </View>
                  )
                ) : null}

                {isStaff ? (
                  submittingToMilestoneId === milestone.id ? (
                    <View style={{ marginTop: spacing.sm }}>
                      <TextField
                        label="Deliverable file name"
                        value={deliverableFileName}
                        onChangeText={setDeliverableFileName}
                        placeholder="e.g. homepage-v1.fig"
                      />
                      <View style={{ flexDirection: "row", gap: spacing.sm }}>
                        <View style={{ flex: 1 }}>
                          <Button
                            label="Submit"
                            loading={submitDeliverableMutation.isPending}
                            disabled={deliverableFileName.trim().length === 0}
                            onPress={() =>
                              submitDeliverableMutation.mutate({
                                milestoneId: milestone.id,
                                fileName: deliverableFileName.trim(),
                              })
                            }
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Button label="Cancel" variant="secondary" onPress={() => setSubmittingToMilestoneId(null)} />
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={{ marginTop: spacing.sm }}>
                      <Button
                        label="Submit deliverable"
                        variant="ghost"
                        onPress={() => setSubmittingToMilestoneId(milestone.id)}
                      />
                    </View>
                  )
                ) : null}
              </Card>
            );
          })
        )}

        {project.updates.length > 0 ? (
          <>
            <Text style={[typography.h3, { color: theme.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
              Updates
            </Text>
            {project.updates.map((update) => (
              <Card key={update.id} style={{ marginBottom: spacing.sm }}>
                <Text style={[typography.body, { color: theme.textPrimary }]}>{update.body}</Text>
                <Text style={[typography.small, { color: theme.textSecondary, marginTop: spacing.xs }]}>
                  {new Date(update.createdAt).toLocaleString()}
                </Text>
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
