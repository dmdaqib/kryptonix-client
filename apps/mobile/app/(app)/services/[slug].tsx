import { useState } from "react";
import { ScrollView, Text, View, StyleSheet, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { TextField } from "../../../src/components/TextField";
import { useAuthStore } from "../../../src/stores/auth-store";
import { apiRequest, ApiError } from "../../../src/lib/api-client";
import { formatCurrency } from "../../../src/lib/format";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { radii, spacing, typography } from "../../../src/theme/tokens";

interface ServicePackage {
  id: string;
  name: string;
  description: string;
  priceAmount: string;
  currency: string;
  taxPercent: string;
  expectedDurationDays: number | null;
  features: { id: string; label: string; included: boolean }[];
}

interface PurchaseInvoice {
  id: string;
}

interface ServiceDetail {
  id: string;
  name: string;
  description: string;
  packages: ServicePackage[];
}

export default function ServiceDetailScreen() {
  const theme = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { activeOrganizationId } = useAuthStore();
  const queryClient = useQueryClient();
  const [showEnquiry, setShowEnquiry] = useState(false);
  const [requirements, setRequirements] = useState("");
  const [purchasingPackageId, setPurchasingPackageId] = useState<string | null>(null);

  const { data: service } = useQuery({
    queryKey: ["catalogue", "service", slug],
    queryFn: () => apiRequest<ServiceDetail>(`/api/v1/catalogue/services/${slug}`, { auth: false }),
  });

  const submitEnquiry = useMutation({
    mutationFn: () =>
      apiRequest("/api/v1/enquiries", {
        method: "POST",
        body: {
          organizationId: activeOrganizationId,
          serviceId: service?.id,
          title: `Custom requirement — ${service?.name}`,
          requirements,
        },
      }),
    onSuccess: () => router.back(),
  });

  const purchasePackage = useMutation({
    mutationFn: (packageId: string) => {
      setPurchasingPackageId(packageId);
      return apiRequest<PurchaseInvoice>(
        `/api/v1/organizations/${activeOrganizationId}/packages/${packageId}/purchase`,
        { method: "POST" },
      );
    },
    onSuccess: (invoice) => {
      // The invoices list and dashboard both cache under this key — without
      // invalidating it, either screen can keep showing "No invoices yet"
      // after a successful purchase until something else happens to trigger
      // a refetch.
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      router.push(`/(app)/invoices/${invoice.id}`);
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Could not start the purchase. Please try again.";
      Alert.alert("Purchase failed", message);
    },
    onSettled: () => setPurchasingPackageId(null),
  });

  if (!service) return null;

  const onlyOnePackage = service.packages.length === 1;

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[typography.h2, { color: theme.textPrimary }]}>{service.name}</Text>
        <Text style={[typography.body, { color: theme.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg }]}>
          {service.description}
        </Text>

        {service.packages.map((pkg) => (
          <Card key={pkg.id} style={{ marginBottom: spacing.md }}>
            <View style={styles.packageHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{pkg.name}</Text>
                  {onlyOnePackage ? (
                    <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                      <Text style={[typography.small, { color: theme.primaryText, fontWeight: "700" }]}>RECOMMENDED</Text>
                    </View>
                  ) : null}
                </View>
                {pkg.expectedDurationDays ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                    <Text style={[typography.caption, { color: theme.textSecondary }]}>
                      ~{pkg.expectedDurationDays} days
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[typography.h3, { color: theme.primary }]}>
                  {formatCurrency(pkg.priceAmount, pkg.currency)}
                </Text>
                {Number(pkg.taxPercent) > 0 ? (
                  <Text style={[typography.caption, { color: theme.textSecondary }]}>
                    +{Number(pkg.taxPercent)}% GST
                  </Text>
                ) : null}
              </View>
            </View>

            <Text style={[typography.body, { color: theme.textSecondary, marginTop: spacing.sm }]}>
              {pkg.description}
            </Text>

            {pkg.features.length > 0 ? (
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
            ) : null}
            {pkg.features.map((f) => (
              <View key={f.id} style={styles.featureRow}>
                <Ionicons
                  name={f.included ? "checkmark-circle" : "close-circle-outline"}
                  size={18}
                  color={f.included ? theme.success : theme.textSecondary}
                />
                <Text style={[typography.body, { color: f.included ? theme.textPrimary : theme.textSecondary }]}>
                  {f.label}
                </Text>
              </View>
            ))}

            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Button
                label={`Buy now — ${formatCurrency(
                  Number(pkg.priceAmount) * (1 + Number(pkg.taxPercent) / 100),
                  pkg.currency,
                )}`}
                onPress={() => purchasePackage.mutate(pkg.id)}
                loading={purchasePackage.isPending && purchasingPackageId === pkg.id}
              />
              <Button label="Ask a question first" variant="secondary" onPress={() => setShowEnquiry(true)} />
            </View>
          </Card>
        ))}

        <Button label="Submit a custom requirement" variant="ghost" onPress={() => setShowEnquiry(true)} />

        {showEnquiry ? (
          <Card style={{ marginTop: spacing.md }}>
            <TextField
              label="Tell us what you need"
              multiline
              numberOfLines={4}
              value={requirements}
              onChangeText={setRequirements}
            />
            <Button
              label="Send to KryptonIX"
              onPress={() => submitEnquiry.mutate()}
              loading={submitEnquiry.isPending}
            />
          </Card>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  packageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: spacing.md,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 4,
  },
});
