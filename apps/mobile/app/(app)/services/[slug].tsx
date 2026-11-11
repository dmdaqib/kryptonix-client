import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { TextField } from "../../../src/components/TextField";
import { useAuthStore } from "../../../src/stores/auth-store";
import { apiRequest } from "../../../src/lib/api-client";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { spacing, typography } from "../../../src/theme/tokens";

interface ServicePackage {
  id: string;
  name: string;
  description: string;
  priceAmount: string;
  currency: string;
  expectedDurationDays: number | null;
  features: { id: string; label: string; included: boolean }[];
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
  const [showEnquiry, setShowEnquiry] = useState(false);
  const [requirements, setRequirements] = useState("");

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

  if (!service) return null;

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[typography.h2, { color: theme.textPrimary }]}>{service.name}</Text>
        <Text style={[typography.body, { color: theme.textSecondary, marginVertical: spacing.sm }]}>
          {service.description}
        </Text>

        {service.packages.map((pkg) => (
          <Card key={pkg.id} style={{ marginBottom: spacing.md }}>
            <Text style={[typography.bodyStrong, { color: theme.textPrimary }]}>{pkg.name}</Text>
            <Text style={[typography.h3, { color: theme.primary, marginVertical: spacing.xs }]}>
              ₹{Number(pkg.priceAmount).toLocaleString("en-IN")}
            </Text>
            <Text style={[typography.body, { color: theme.textSecondary }]}>{pkg.description}</Text>
            {pkg.features.map((f) => (
              <Text key={f.id} style={[typography.caption, { color: theme.textSecondary }]}>
                {f.included ? "✓" : "✗"} {f.label}
              </Text>
            ))}
            <View style={{ marginTop: spacing.md }}>
              <Button label="Request this package" variant="secondary" onPress={() => setShowEnquiry(true)} />
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
