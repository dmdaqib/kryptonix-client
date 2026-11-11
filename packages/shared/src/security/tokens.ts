// Secure, single-use tokens for email verification, password reset and
// invitations. We hand the raw token to the user (via email/link) and store
// only its SHA-256 hash, so a stolen database dump can't be replayed as a
// valid token.

import { randomBytes, createHash } from "node:crypto";

export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function addDuration(base: Date, ms: number): Date {
  return new Date(base.getTime() + ms);
}

export const DURATIONS = {
  EMAIL_VERIFICATION_MS: 24 * 60 * 60 * 1000, // 24h
  PASSWORD_RESET_MS: 60 * 60 * 1000, // 1h
  INVITATION_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  ACCESS_TOKEN_MS: 15 * 60 * 1000, // 15 min
  REFRESH_TOKEN_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
} as const;
