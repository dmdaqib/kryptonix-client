// Coarse-grained role → permission matrix. Fine-grained per-organization
// overrides live in the Role/Permission/RolePermission tables (see
// prisma/schema.prisma); this module is the hardcoded default every
// deployment starts with, and the single source of truth the backend
// middleware consults on every request. UI screens may hide actions a role
// can't perform, but that is a convenience only — see
// docs/security.md §Authorization: the backend is the only enforcement
// point that actually matters.

export type ClientRole = "OWNER" | "ADMIN" | "MEMBER" | "FINANCE";
export type StaffRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "SALES_MANAGER"
  | "PROJECT_MANAGER"
  | "DEVELOPER"
  | "DESIGNER"
  | "FINANCE_MANAGER"
  | "SUPPORT_STAFF";

export type Permission =
  | "org.manage_members"
  | "org.view"
  | "invoices.view"
  | "invoices.pay"
  | "invoices.create"
  | "invoices.refund.request"
  | "invoices.refund.approve"
  | "quotes.view"
  | "quotes.accept"
  | "quotes.create"
  | "quotes.send"
  | "projects.view"
  | "projects.manage"
  | "deliverables.approve"
  | "support.create_ticket"
  | "support.manage_tickets"
  | "staff.manage_clients"
  | "staff.manage_catalogue"
  | "admin.full_access";

const CLIENT_ROLE_PERMISSIONS: Record<ClientRole, Permission[]> = {
  OWNER: [
    "org.manage_members",
    "org.view",
    "invoices.view",
    "invoices.pay",
    "invoices.refund.request",
    "quotes.view",
    "quotes.accept",
    "projects.view",
    "deliverables.approve",
    "support.create_ticket",
  ],
  ADMIN: [
    "org.view",
    "invoices.view",
    "invoices.pay",
    "invoices.refund.request",
    "quotes.view",
    "quotes.accept",
    "projects.view",
    "deliverables.approve",
    "support.create_ticket",
  ],
  MEMBER: ["org.view", "projects.view", "support.create_ticket"],
  FINANCE: [
    "org.view",
    "invoices.view",
    "invoices.pay",
    "invoices.refund.request",
    "projects.view",
  ],
};

const STAFF_ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  SUPER_ADMIN: ["admin.full_access"],
  ADMIN: ["staff.manage_clients", "org.view", "projects.view"],
  SALES_MANAGER: ["quotes.create", "quotes.send", "quotes.view", "org.view"],
  PROJECT_MANAGER: ["projects.manage", "projects.view", "org.view"],
  DEVELOPER: ["projects.view"],
  DESIGNER: ["projects.view"],
  FINANCE_MANAGER: [
    "invoices.create",
    "invoices.view",
    "invoices.refund.approve",
    "org.view",
  ],
  SUPPORT_STAFF: ["support.manage_tickets", "org.view"],
};

export function clientHasPermission(
  role: ClientRole,
  permission: Permission,
): boolean {
  return CLIENT_ROLE_PERMISSIONS[role].includes(permission);
}

export function staffHasPermission(
  role: StaffRole,
  permission: Permission,
): boolean {
  if (role === "SUPER_ADMIN") return true; // admin.full_access short-circuits
  return STAFF_ROLE_PERMISSIONS[role].includes(permission);
}
