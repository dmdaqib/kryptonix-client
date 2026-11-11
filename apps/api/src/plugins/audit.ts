import { prisma } from "../db/prisma.ts";

interface AuditEntry {
  organizationId?: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metaJson?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Append-only audit trail. Called explicitly from service functions at the
 * points the spec calls out (invitations, quote/agreement acceptance,
 * payment state changes, refunds, approvals) rather than generically
 * wrapping every request, so entries stay meaningful.
 */
export async function recordAudit(entry: AuditEntry) {
  await prisma.auditLog.create({
    data: {
      organizationId: entry.organizationId,
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metaJson: entry.metaJson,
      ipAddress: entry.ipAddress,
    },
  });
}
