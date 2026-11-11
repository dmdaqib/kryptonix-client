import { test } from "node:test";
import assert from "node:assert/strict";
import { signJwt, verifyJwt, JwtError } from "./jwt.ts";

const SECRET = "test-secret-do-not-use-in-prod";

test("signs and verifies a valid token", () => {
  const token = signJwt(
    { sub: "user_1", sid: "session_1", role: "CLIENT" },
    SECRET,
    900,
  );
  const payload = verifyJwt(token, SECRET);
  assert.equal(payload.sub, "user_1");
  assert.equal(payload.role, "CLIENT");
});

test("rejects a token signed with a different secret", () => {
  const token = signJwt(
    { sub: "user_1", sid: "session_1", role: "CLIENT" },
    SECRET,
    900,
  );
  assert.throws(() => verifyJwt(token, "a-different-secret"), JwtError);
});

test("rejects an expired token", () => {
  const token = signJwt(
    { sub: "user_1", sid: "session_1", role: "CLIENT" },
    SECRET,
    -10, // already expired
  );
  assert.throws(() => verifyJwt(token, SECRET), JwtError);
});

test("rejects a tampered payload", () => {
  const token = signJwt(
    { sub: "user_1", sid: "session_1", role: "CLIENT" },
    SECRET,
    900,
  );
  const [header, payload, signature] = token.split(".");
  const tamperedPayload = Buffer.from(
    JSON.stringify({ sub: "attacker", role: "STAFF" }),
  ).toString("base64url");
  assert.throws(
    () => verifyJwt(`${header}.${tamperedPayload}.${signature}`, SECRET),
    JwtError,
  );
});

test("rejects a malformed token", () => {
  assert.throws(() => verifyJwt("not.a.valid.jwt", SECRET), JwtError);
});
