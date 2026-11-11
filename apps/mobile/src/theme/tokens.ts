// KryptonIX design tokens.
//
// Brand source of truth: https://kryptonix.digital/ — the only brand signal
// published on the site itself is the theme color #7C3AED (violet). No
// brand font is published there, so this uses Inter, a neutral, highly
// legible system-grade typeface common to modern SaaS products — swap
// `fontFamily` below the moment KryptonIX shares an official brand font.
//
// The real logo asset (kryptonix-logo.png) is referenced from the site but
// hasn't been dropped into apps/mobile/assets/ yet — see PROGRESS.md.

export const colors = {
  // Primary violet scale, generated from the brand's #7C3AED.
  violet50: "#F5F3FF",
  violet100: "#EDE9FE",
  violet200: "#DDD6FE",
  violet300: "#C4B5FD",
  violet400: "#A78BFA",
  violet500: "#8B5CF6",
  violet600: "#7C3AED", // brand primary
  violet700: "#6D28D9",
  violet800: "#5B21B6",
  violet900: "#4C1D95",

  neutral0: "#FFFFFF",
  neutral50: "#F9FAFB",
  neutral100: "#F3F4F6",
  neutral200: "#E5E7EB",
  neutral300: "#D1D5DB",
  neutral400: "#9CA3AF",
  neutral500: "#6B7280",
  neutral600: "#4B5563",
  neutral700: "#374151",
  neutral800: "#1F2937",
  neutral900: "#111827",

  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
  info: "#2563EB",
};

export const lightTheme = {
  background: colors.neutral0,
  surface: colors.neutral50,
  card: colors.neutral0,
  border: colors.neutral200,
  textPrimary: colors.neutral900,
  textSecondary: colors.neutral500,
  primary: colors.violet600,
  primaryText: colors.neutral0,
  danger: colors.danger,
  success: colors.success,
  warning: colors.warning,
};

export const darkTheme = {
  background: colors.neutral900,
  surface: colors.neutral800,
  card: colors.neutral800,
  border: colors.neutral700,
  textPrimary: colors.neutral50,
  textSecondary: colors.neutral400,
  primary: colors.violet400,
  primaryText: colors.neutral900,
  danger: "#F87171",
  success: "#4ADE80",
  warning: "#FBBF24",
};

export type Theme = typeof lightTheme;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
};

export const typography = {
  fontFamily: "Inter", // load via expo-font once the real brand font is confirmed
  h1: { fontSize: 28, fontWeight: "700" as const, lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: "700" as const, lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: "600" as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: "600" as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
  small: { fontSize: 12, fontWeight: "400" as const, lineHeight: 16 },
};
