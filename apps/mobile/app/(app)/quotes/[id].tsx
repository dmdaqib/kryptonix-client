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
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { StatusPill } from "../../../src/components/StatusPill";
import { apiRequest } from "../../../src/lib/api-client";
import { formatCurrency } from "../../../src/lib/format";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { colors, radii, spacing, typography } from "../../../src/theme/tokens";

interface QuoteDetail {
  id: string;
  quoteNumber: string;
  status: string;
  scopeOfWork: string;
  exclusions?: string | null;
  subtotalAmount: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  currency: string;
  paymentTerms?: string | null;
  validUntil?: string | null;
  createdAt: string;
  items: { id: string; description: string; quantity: number; unitPrice: string; lineTotal: string }[];
  acceptance?: { acceptedAt: string; acceptedQuoteVersion: number; ipAddress?: string } | null;
}

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();

  const [revisionNotes, setRevisionNotes] = useState("");
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [isActing, setIsActing] = useState(false);

  const { data: quote, isLoading, refetch } = useQuery({
    queryKey: ["quote", id],
    queryFn: () => apiRequest<QuoteDetail>(`/api/v1/quotes/${id}`),
    enabled: Boolean(id),
  });

  const handleAcceptQuote = async () => {
    Alert.alert(
      "Accept Proposal",
      "By accepting this proposal, you confirm the scope of work and payment terms. An official invoice will be generated.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept Proposal",
          onPress: async () => {
            setIsActing(true);
            try {
              await apiRequest(`/api/v1/quotes/${id}/accept`, { method: "POST" });
              Alert.alert("Proposal Accepted", "Thank you! The proposal is accepted and your invoice is ready.");
              await refetch();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Failed to accept proposal";
              Alert.alert("Action Failed", msg);
            } finally {
              setIsActing(false);
            }
          },
        },
      ],
    );
  };

  const handleRejectQuote = async () => {
    Alert.alert(
      "Decline Proposal",
      "Are you sure you want to decline this proposal? You can submit an updated requirement at any time.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            setIsActing(true);
            try {
              await apiRequest(`/api/v1/quotes/${id}/reject`, { method: "POST" });
              Alert.alert("Proposal Declined", "The proposal has been marked as declined.");
              await refetch();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Failed to reject proposal";
              Alert.alert("Action Failed", msg);
            } finally {
              setIsActing(false);
            }
          },
        },
      ],
    );
  };

  const handleRequestRevision = async () => {
    if (!revisionNotes.trim()) {
      Alert.alert("Notes Required", "Please specify the changes or adjustments you need in the scope.");
      return;
    }
    setIsActing(true);
    try {
      await apiRequest(`/api/v1/quotes/${id}/request-revision`, {
        method: "POST",
        body: { notes: revisionNotes.trim() },
      });
      Alert.alert("Revision Requested", "Your revision request has been forwarded to the KryptonIX sales team.");
      setShowRevisionDialog(false);
      setRevisionNotes("");
      await refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to request revision";
      Alert.alert("Action Failed", msg);
    } finally {
      setIsActing(false);
    }
  };

  if (isLoading || !quote) {
    return (
      <ScreenContainer>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </ScreenContainer>
    );
  }

  const canTakeAction = quote.status === "SENT" || quote.status === "VIEWED";

  return (
    <ScreenContainer>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={[typography.h3, { color: theme.textPrimary }]}>Proposal #{quote.quoteNumber}</Text>
        <StatusPill status={quote.status} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Acceptance Confirmation Banner */}
        {quote.acceptance && (
          <View style={styles.acceptedBanner}>
            <Ionicons name="checkmark-done-circle" size={24} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyStrong, { color: colors.success }]}>Proposal Accepted</Text>
              <Text style={[typography.small, { color: theme.textSecondary }]}>
                Recorded on {new Date(quote.acceptance.acceptedAt).toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        {/* Scope of Work */}
        <Card style={styles.card}>
          <Text style={[typography.caption, { color: theme.textSecondary, fontWeight: "600" }]}>
            SCOPE OF WORK & DELIVERABLES
          </Text>
          <Text style={[typography.body, { color: theme.textPrimary, marginTop: spacing.xs, lineHeight: 22 }]}>
            {quote.scopeOfWork}
          </Text>
          {quote.exclusions && (
            <View style={{ marginTop: spacing.sm }}>
              <Text style={[typography.caption, { color: colors.danger, fontWeight: "600" }]}>EXCLUSIONS</Text>
              <Text style={[typography.small, { color: theme.textSecondary, marginTop: 2 }]}>
                {quote.exclusions}
              </Text>
            </View>
          )}
        </Card>

        {/* Line Items */}
        <Text style={[typography.bodyStrong, { color: theme.textPrimary, marginTop: spacing.lg, marginBottom: spacing.xs }]}>
          Deliverables & Commercial Items
        </Text>
        <Card style={styles.card}>
          {quote.items.map((item, idx) => (
            <View key={item.id ?? idx} style={styles.itemRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{item.description}</Text>
                <Text style={[typography.caption, { color: theme.textSecondary }]}>
                  Qty: {item.quantity} × {formatCurrency(Number(item.unitPrice))}
                </Text>
              </View>
              <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
                {formatCurrency(Number(item.lineTotal))}
              </Text>
            </View>
          ))}
        </Card>

        {/* Commercial Summary */}
        <Text style={[typography.bodyStrong, { color: theme.textPrimary, marginTop: spacing.lg, marginBottom: spacing.xs }]}>
          Commercial Summary
        </Text>
        <Card style={styles.card}>
          <View style={styles.summaryRow}>
            <Text style={[typography.body, { color: theme.textSecondary }]}>Subtotal</Text>
            <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
              {formatCurrency(Number(quote.subtotalAmount))}
            </Text>
          </View>
          {Number(quote.discountAmount) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[typography.body, { color: colors.success }]}>Discount</Text>
              <Text style={[typography.bodyStrong, { color: colors.success }]}>
                -{formatCurrency(Number(quote.discountAmount))}
              </Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={[typography.body, { color: theme.textSecondary }]}>Applicable GST (18%)</Text>
            <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>
              {formatCurrency(Number(quote.taxAmount))}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.summaryRow}>
            <Text style={[typography.h3, { color: theme.textPrimary }]}>Total Proposed Amount</Text>
            <Text style={[typography.h3, { color: theme.primary }]}>
              {formatCurrency(Number(quote.totalAmount))}
            </Text>
          </View>
          {quote.paymentTerms && (
            <View style={[styles.termsBox, { backgroundColor: colors.violet50 }]}>
              <Text style={[typography.small, { color: colors.violet700, fontWeight: "600" }]}>
                Payment Terms: {quote.paymentTerms}
              </Text>
            </View>
          )}
        </Card>

        {/* Revision Request Form if open */}
        {showRevisionDialog && (
          <Card style={[styles.card, { marginTop: spacing.md, borderColor: colors.violet400, borderWidth: 1.5 }]}>
            <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>Request Scope Adjustments</Text>
            <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 2 }]}>
              Describe the features, timelines, or pricing revisions you require:
            </Text>
            <TextInput
              style={[styles.revisionInput, { borderColor: theme.border, color: theme.textPrimary }]}
              placeholder="e.g. Please add payment gateway integration to milestone 2..."
              placeholderTextColor={theme.textSecondary}
              value={revisionNotes}
              onChangeText={setRevisionNotes}
              multiline
              numberOfLines={3}
            />
            <View style={styles.dialogActions}>
              <Button label="Cancel" variant="outline" size="sm" onPress={() => setShowRevisionDialog(false)} />
              <Button label="Submit Revision" size="sm" onPress={handleRequestRevision} disabled={isActing} />
            </View>
          </Card>
        )}

        {/* Action Buttons */}
        {canTakeAction && !showRevisionDialog && (
          <View style={styles.actionsContainer}>
            <Button
              label={isActing ? "Processing..." : "Accept Proposal"}
              onPress={handleAcceptQuote}
              disabled={isActing}
              style={{ width: "100%" }}
            />
            <View style={styles.secondaryActions}>
              <Button
                label="Request Revision"
                variant="outline"
                onPress={() => setShowRevisionDialog(true)}
                style={{ flex: 1 }}
              />
              <Button
                label="Decline"
                variant="outline"
                onPress={handleRejectQuote}
                style={{ flex: 1, borderColor: colors.danger }}
              />
            </View>
          </View>
        )}

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
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  card: {
    padding: spacing.md,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral200,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  divider: {
    height: 1,
    marginVertical: spacing.xs,
  },
  termsBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
  },
  revisionInput: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 14,
  },
  dialogActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionsContainer: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  secondaryActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
