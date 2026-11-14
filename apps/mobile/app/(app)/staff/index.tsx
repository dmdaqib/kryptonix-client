import { useState } from "react";
import {
  ScrollView,
  View,
  Text,
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
import { StatusPill } from "../../../src/components/StatusPill";
import { EmptyState } from "../../../src/components/EmptyState";
import { useAuthStore } from "../../../src/stores/auth-store";
import { apiRequest } from "../../../src/lib/api-client";
import { formatCurrency } from "../../../src/lib/format";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { colors, radii, spacing, typography } from "../../../src/theme/tokens";

interface StaffEnquiry {
  id: string;
  title: string;
  requirements: string;
  status: string;
  createdAt: string;
  organization?: { id: string; name: string };
  budgetRangeMin?: number;
  budgetRangeMax?: number;
}

interface StaffTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  organization?: { name: string };
}

export default function StaffPortalScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"enquiries" | "tickets">("enquiries");

  // Query staff enquiries queue
  const { data: enquiries, isLoading: enquiriesLoading, refetch: refetchEnquiries } = useQuery({
    queryKey: ["staff-enquiries"],
    queryFn: () => apiRequest<StaffEnquiry[]>("/api/v1/staff/enquiries"),
    enabled: user?.userType === "STAFF",
  });

  // Query staff tickets queue
  const { data: tickets, isLoading: ticketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ["staff-tickets"],
    queryFn: () => apiRequest<StaffTicket[]>("/api/v1/tickets"),
    enabled: user?.userType === "STAFF",
  });

  if (user?.userType !== "STAFF") {
    return (
      <ScreenContainer>
        <EmptyState
          title="Staff Access Only"
          description="This operational dashboard is restricted to authorized KryptonIX team members."
          actionLabel="Return to Dashboard"
          onAction={() => router.replace("/(app)/dashboard" as Parameters<typeof router.replace>[0])}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[typography.h3, { color: theme.textPrimary }]}>Staff Operations Hub</Text>
          <Text style={[typography.small, { color: colors.violet700, fontWeight: "700" }]}>
            Role: {user.staffRole ?? "SUPER_ADMIN"}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <Pressable
          style={[styles.tabBtn, activeTab === "enquiries" && styles.tabBtnActive]}
          onPress={() => setActiveTab("enquiries")}
        >
          <Text style={[styles.tabText, activeTab === "enquiries" && styles.tabTextActive]}>
            Enquiries Queue ({(enquiries ?? []).length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === "tickets" && styles.tabBtnActive]}
          onPress={() => setActiveTab("tickets")}
        >
          <Text style={[styles.tabText, activeTab === "tickets" && styles.tabTextActive]}>
            Support Tickets ({(tickets ?? []).length})
          </Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {activeTab === "enquiries" ? (
          enquiriesLoading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
          ) : !enquiries || enquiries.length === 0 ? (
            <EmptyState title="Queue Empty" description="No client enquiries currently pending review." />
          ) : (
            <View style={styles.list}>
              {enquiries.map((enq) => (
                <Card key={enq.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.caption, { color: theme.textSecondary }]}>
                        Client: {enq.organization?.name ?? "Client Organization"}
                      </Text>
                      <Text style={[typography.h3, { color: theme.textPrimary, marginTop: 2 }]}>
                        {enq.title}
                      </Text>
                    </View>
                    <StatusPill status={enq.status} />
                  </View>

                  <Text
                    style={[typography.caption, { color: theme.textSecondary, marginTop: spacing.xs }]}
                    numberOfLines={3}
                  >
                    {enq.requirements}
                  </Text>

                  {enq.budgetRangeMin && (
                    <Text style={[typography.small, { color: theme.primary, fontWeight: "700", marginTop: 6 }]}>
                      Budget: {formatCurrency(enq.budgetRangeMin)} - {formatCurrency(enq.budgetRangeMax ?? 0)}
                    </Text>
                  )}

                  <View style={styles.cardFooter}>
                    <Text style={[typography.small, { color: theme.textSecondary }]}>
                      Received {new Date(enq.createdAt).toLocaleDateString()}
                    </Text>
                    <Button
                      label="Assign to Me"
                      size="sm"
                      onPress={async () => {
                        try {
                          await apiRequest(`/api/v1/staff/enquiries/${enq.id}/assign`, {
                            method: "POST",
                            body: { assignedToUserId: user.id },
                          });
                          Alert.alert("Assigned", "Enquiry assigned to your staff profile.");
                          await refetchEnquiries();
                        } catch (err: unknown) {
                          const msg = err instanceof Error ? err.message : "Failed to assign";
                          Alert.alert("Error", msg);
                        }
                      }}
                    />
                  </View>
                </Card>
              ))}
            </View>
          )
        ) : (
          ticketsLoading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
          ) : !tickets || tickets.length === 0 ? (
            <EmptyState title="No Tickets" description="Support ticket queue is completely clear." />
          ) : (
            <View style={styles.list}>
              {tickets.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => router.push(`/(app)/tickets/${t.id}` as Parameters<typeof router.push>[0])}
                >
                  <Card style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.caption, { color: theme.textSecondary }]}>
                          #{t.ticketNumber} • {t.organization?.name}
                        </Text>
                        <Text style={[typography.bodyStrong, { color: theme.textPrimary, marginTop: 2 }]}>
                          {t.subject}
                        </Text>
                      </View>
                      <StatusPill status={t.status} />
                    </View>

                    <View style={styles.cardFooter}>
                      <View style={styles.priorityPill}>
                        <Text style={styles.priorityText}>Priority: {t.priority}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          )
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  backButton: {
    padding: 4,
  },
  tabsRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: radii.md,
    backgroundColor: colors.neutral100,
  },
  tabBtnActive: {
    backgroundColor: colors.violet700,
  },
  tabText: {
    ...typography.caption,
    color: colors.neutral600,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    padding: spacing.md,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral200,
  },
  priorityPill: {
    backgroundColor: colors.neutral100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  priorityText: {
    ...typography.small,
    fontWeight: "600",
    color: colors.neutral700,
  },
});

