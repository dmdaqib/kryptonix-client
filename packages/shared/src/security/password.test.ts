import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password.ts";

test("hashes and verifies a correct password", async () => {
  const hash = await hashPassword("correct-horse-battery-staple");
  assert.equal(await verifyPassword("correct-horse-battery-staple", hash), true);
});

test("rejects an incorrect password", async () => {
  const hash = await hashPassword("correct-horse-battery-staple");
  assert.equal(await verifyPassword("wrong-password", hash), false);
});

test("two hashes of the same password are different (random salt)", async () => {
  const a = await hashPassword("same-password-123");
  const b = await hashPassword("same-password-123");
  assert.notEqual(a, b);
});

test("rejects passwords shorter than 8 characters", async () => {
  await assert.rejects(() => hashPassword("short"));
});

test("rejects malformed stored hashes instead of throwing", async () => {
  assert.equal(await verifyPassword("anything", "not-a-real-hash"), false);
});
