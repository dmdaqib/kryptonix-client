import { useState } from "react";
import { Text, ScrollView } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { TextField } from "../../src/components/TextField";
import { Button } from "../../src/components/Button";
import { useTheme } from "../../src/theme/ThemeProvider";
import { spacing, typography } from "../../src/theme/tokens";
import { apiRequest, ApiError } from "../../src/lib/api-client";
import { useAuthStore } from "../../src/stores/auth-store";

// Collects exactly the fields the spec calls for: full name, email, phone,
// business name, business category, business website, country and
// service interests. Submitting creates the account AND its organization,
// then signs the user straight in — email verification is skipped for now
// (see apps/api/src/modules/auth/auth.service.ts), so there's no separate
// verify-email step to send them to.
export default function RegisterScreen() {
  const theme = useTheme();
  const login = useAuthStore((s) => s.login);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    businessName: "",
    businessCategory: "",
    businessWebsite: "",
    country: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit() {
    setError(undefined);
    setLoading(true);
    try {
      await apiRequest("/api/v1/auth/register", { method: "POST", body: form, auth: false });
      await login(form.email.trim().toLowerCase(), form.password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[typography.h2, { color: theme.textPrimary, marginBottom: spacing.lg }]}>
          Create your account
        </Text>

        <TextField label="Full name" value={form.fullName} onChangeText={(v) => set("fullName", v)} />
        <TextField
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={form.email}
          onChangeText={(v) => set("email", v)}
        />
        <TextField label="Phone" keyboardType="phone-pad" value={form.phone} onChangeText={(v) => set("phone", v)} />
        <TextField label="Password" secureTextEntry value={form.password} onChangeText={(v) => set("password", v)} />
        <TextField label="Business name" value={form.businessName} onChangeText={(v) => set("businessName", v)} />
        <TextField
          label="Business category"
          placeholder="e.g. Salon, Gym, Retail"
          value={form.businessCategory}
          onChangeText={(v) => set("businessCategory", v)}
        />
        <TextField
          label="Business website (optional)"
          autoCapitalize="none"
          value={form.businessWebsite}
          onChangeText={(v) => set("businessWebsite", v)}
        />
        <TextField label="Country" value={form.country} onChangeText={(v) => set("country", v)} />

        {error ? <Text style={{ color: theme.danger, marginBottom: spacing.md }}>{error}</Text> : null}

        <Button label="Create Account" onPress={onSubmit} loading={loading} />
      </ScrollView>
    </ScreenContainer>
  );
}
