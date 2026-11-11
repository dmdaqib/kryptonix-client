// Password hashing using Node's built-in scrypt (no external dependency —
// deliberately avoids a native-module package so this runs anywhere Node
// runs, including CI containers with no build toolchain).
//
// Format: scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>
// N/r/p are encoded per-hash so parameters can be upgraded later without
// invalidating existing hashes.

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Uses the synchronous scryptSync rather than promisify(scrypt): Node's
// scrypt has two overloads (with and without an options object before the
// callback), and @types/node's promisify typing for it only reliably
// exposes the no-options 3-argument shape — passing { N, r, p } as a 4th
// argument then fails to typecheck (a real CI-caught error, not a sandbox
// artifact). scryptSync has a single, unambiguous signature that takes
// options directly. The cost: this blocks the event loop for ~50-100ms per
// call. Acceptable for an auth endpoint's request volume; revisit with a
// worker-thread wrapper if login throughput ever makes that blocking time
// a bottleneck.

const DEFAULT_N = 16384; // cost factor (2^14)
const DEFAULT_R = 8;
const DEFAULT_P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(plain, salt, KEY_LENGTH, {
    N: DEFAULT_N,
    r: DEFAULT_R,
    p: DEFAULT_P,
  });

  return [
    "scrypt",
    DEFAULT_N,
    DEFAULT_R,
    DEFAULT_P,
    salt.toString("hex"),
    derived.toString("hex"),
  ].join("$");
}

export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nStr, rStr, pStr, saltHex, hashHex] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");

  const derived = scryptSync(plain, salt, expected.length, { N, r, p });

  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
