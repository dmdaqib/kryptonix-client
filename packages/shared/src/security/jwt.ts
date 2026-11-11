// Minimal, dependency-free HS256 JWT sign/verify built on Node's crypto
// module. Access tokens are short-lived and stateless; refresh tokens are
// opaque random strings stored (hashed) in the database instead — see
// apps/api/src/modules/auth — so revocation is immediate and reliable.
//
// This is intentionally small in scope (HS256 only, no external claims
// registry beyond what we need) rather than pulling in a general-purpose
// JWT library for a single algorithm.

import { createHmac, timingSafeEqual } from "node:crypto";

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export interface JwtPayload {
  sub: string; // user id
  sid: string; // session id
  role: string; // "CLIENT" | "STAFF"
  iat: number;
  exp: number;
}
// Deliberately no index signature here: with one present, `keyof JwtPayload`
// collapses to `string` and `Omit<JwtPayload, "iat" | "exp">` below stops
// requiring sub/sid/role — a real bug CI's typecheck caught, not a
// sandbox artifact. If arbitrary extra claims are ever needed, add a
// separate `extra?: Record<string, unknown>` field instead of widening this
// via an index signature.

export function signJwt(
  payload: Omit<JwtPayload, "iat" | "exp">,
  secret: string,
  ttlSeconds: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload: JwtPayload = { ...payload, iat: now, exp: now + ttlSeconds };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(fullPayload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export class JwtError extends Error {}

export function verifyJwt(token: string, secret: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new JwtError("Malformed token");
  const [encodedHeader, encodedPayload, signature] = parts as [
    string,
    string,
    string,
  ];

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, secret);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    throw new JwtError("Invalid signature");
  }

  const payload = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8"),
  ) as JwtPayload;

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new JwtError("Token expired");
  }

  return payload;
}
