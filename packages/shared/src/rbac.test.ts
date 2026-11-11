import { test } from "node:test";
import assert from "node:assert/strict";
import { clientHasPermission, staffHasPermission } from "./rbac.ts";

test("client OWNER can manage org members; MEMBER cannot", () => {
  assert.equal(clientHasPermission("OWNER", "org.manage_members"), true);
  assert.equal(clientHasPermission("MEMBER", "org.manage_members"), false);
});

test("client MEMBER cannot pay invoices; FINANCE can", () => {
  assert.equal(clientHasPermission("MEMBER", "invoices.pay"), false);
  assert.equal(clientHasPermission("FINANCE", "invoices.pay"), true);
});

test("staff SUPER_ADMIN has every permission via full_access short-circuit", () => {
  assert.equal(staffHasPermission("SUPER_ADMIN", "invoices.refund.approve"), true);
  assert.equal(staffHasPermission("SUPER_ADMIN", "staff.manage_catalogue"), true);
});

test("staff DEVELOPER cannot approve refunds or manage clients", () => {
  assert.equal(staffHasPermission("DEVELOPER", "invoices.refund.approve"), false);
  assert.equal(staffHasPermission("DEVELOPER", "staff.manage_clients"), false);
});

test("only FINANCE_MANAGER (or super admin) can approve refunds", () => {
  assert.equal(staffHasPermission("FINANCE_MANAGER", "invoices.refund.approve"), true);
  assert.equal(staffHasPermission("SALES_MANAGER", "invoices.refund.approve"), false);
  assert.equal(staffHasPermission("SUPPORT_STAFF", "invoices.refund.approve"), false);
});
