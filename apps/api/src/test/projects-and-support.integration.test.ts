import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../server.ts";
import { createClientOrgOwner, createStaffUser, authHeader, type ClientOwner, type AuthedUser } from "./helpers.ts";

/**
 * End-to-end integration test against a real Postgres database (CI's
 * postgres service container — see .github/workflows/ci.yml). Unlike
 * packages/shared's unit tests, this exercises actual Fastify routes via
 * app.inject() (no real port bind needed) against actual Prisma queries,
 * so it proves the P3 (projects/milestones/deliverables/messaging) and P5
 * (support tickets/notifications) route handlers are wired correctly end
 * to end — not just that they typecheck.
 */

let app: FastifyInstance;
let pm: AuthedUser;
let support: AuthedUser;
let client: ClientOwner;
let projectId: string;
let milestoneId: string;
let fileId: string;
let deliverableId: string;
let conversationId: string;
let ticketId: string;

before(async () => {
  app = await buildServer();
  pm = await createStaffUser("PROJECT_MANAGER");
  support = await createStaffUser("SUPPORT_STAFF");
  client = await createClientOrgOwner();
});

after(async () => {
  await app.close();
});

test("staff creates a project for the client organization", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/projects",
    headers: authHeader(pm),
    payload: { organizationId: client.organizationId, name: "Glow Salon — Booking Website" },
  });
  assert.equal(res.statusCode, 201);
  const body = res.json();
  assert.equal(body.data.status, "NOT_STARTED");
  projectId = body.data.id;
});

test("client can see the project in their organization's list", async () => {
  const res = await app.inject({
    method: "GET",
    url: `/api/v1/organizations/${client.organizationId}/projects`,
    headers: authHeader(client),
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(body.data.some((p: { id: string }) => p.id === projectId));
});

test("an unrelated client cannot read the project", async () => {
  const outsider = await createClientOrgOwner();
  const res = await app.inject({
    method: "GET",
    url: `/api/v1/projects/${projectId}`,
    headers: authHeader(outsider),
  });
  assert.equal(res.statusCode, 403);
});

test("project manager adds themself as a project member", async () => {
  const res = await app.inject({
    method: "POST",
    url: `/api/v1/projects/${projectId}/members`,
    headers: authHeader(pm),
    payload: { userId: pm.id, isManager: true },
  });
  assert.equal(res.statusCode, 201);
});

test("project manager creates a milestone requiring client approval", async () => {
  const res = await app.inject({
    method: "POST",
    url: `/api/v1/projects/${projectId}/milestones`,
    headers: authHeader(pm),
    payload: { name: "Design sign-off", requiresClientApproval: true },
  });
  assert.equal(res.statusCode, 201);
  const body = res.json();
  assert.equal(body.data.status, "NOT_STARTED");
  milestoneId = body.data.id;
});

test("project manager registers a file against the project", async () => {
  const res = await app.inject({
    method: "POST",
    url: `/api/v1/projects/${projectId}/files`,
    headers: authHeader(pm),
    payload: {
      category: "design",
      originalName: "homepage-mockup.fig",
      storageKey: "test/homepage-mockup.fig",
      mimeType: "application/octet-stream",
      sizeBytes: 1024,
    },
  });
  assert.equal(res.statusCode, 201);
  fileId = res.json().data.id;
});

test("submitting a deliverable moves the milestone to SUBMITTED_FOR_REVIEW and notifies the client", async () => {
  const res = await app.inject({
    method: "POST",
    url: `/api/v1/milestones/${milestoneId}/deliverables`,
    headers: authHeader(pm),
    payload: { fileId },
  });
  assert.equal(res.statusCode, 201);
  deliverableId = res.json().data.id;

  const milestoneCheck = await app.inject({
    method: "GET",
    url: `/api/v1/projects/${projectId}`,
    headers: authHeader(client),
  });
  const milestone = milestoneCheck.json().data.milestones.find((m: { id: string }) => m.id === milestoneId);
  assert.equal(milestone.status, "SUBMITTED_FOR_REVIEW");

  const notifications = await app.inject({
    method: "GET",
    url: "/api/v1/notifications",
    headers: authHeader(client),
  });
  assert.ok(notifications.json().data.some((n: { type: string }) => n.type === "deliverable.submitted"));
});

test("client approving the deliverable completes the milestone and notifies project staff", async () => {
  const res = await app.inject({
    method: "POST",
    url: `/api/v1/deliverables/${deliverableId}/approve`,
    headers: authHeader(client),
  });
  assert.equal(res.statusCode, 201);
  assert.equal(res.json().data.decision, "APPROVED");

  const projectCheck = await app.inject({
    method: "GET",
    url: `/api/v1/projects/${projectId}`,
    headers: authHeader(client),
  });
  const milestone = projectCheck.json().data.milestones.find((m: { id: string }) => m.id === milestoneId);
  assert.equal(milestone.status, "APPROVED");

  const pmNotifications = await app.inject({
    method: "GET",
    url: "/api/v1/notifications",
    headers: authHeader(pm),
  });
  assert.ok(pmNotifications.json().data.some((n: { type: string }) => n.type === "deliverable.approved"));
});

test("client and staff exchange project messages over the lazily-created conversation", async () => {
  const convoRes = await app.inject({
    method: "GET",
    url: `/api/v1/projects/${projectId}/conversation`,
    headers: authHeader(client),
  });
  assert.equal(convoRes.statusCode, 200);
  conversationId = convoRes.json().data.id;

  const clientMsg = await app.inject({
    method: "POST",
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: authHeader(client),
    payload: { body: "When will the homepage be ready?" },
  });
  assert.equal(clientMsg.statusCode, 201);

  const pmReply = await app.inject({
    method: "POST",
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: authHeader(pm),
    payload: { body: "Design is approved — build starts today." },
  });
  assert.equal(pmReply.statusCode, 201);

  const history = await app.inject({
    method: "GET",
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: authHeader(client),
  });
  const bodies = history.json().data.map((m: { body: string }) => m.body);
  assert.deepEqual(bodies, ["When will the homepage be ready?", "Design is approved — build starts today."]);
});

test("a client cannot post an internal staff note", async () => {
  const res = await app.inject({
    method: "POST",
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: authHeader(client),
    payload: { body: "trying to sneak an internal note", isInternalNote: true },
  });
  assert.equal(res.statusCode, 403);
});

test("client raises a support ticket and it lands in the staff queue", async () => {
  const createRes = await app.inject({
    method: "POST",
    url: `/api/v1/organizations/${client.organizationId}/tickets`,
    headers: authHeader(client),
    payload: { category: "billing", subject: "Invoice GST looks wrong", description: "The GST line seems too high for this invoice." },
  });
  assert.equal(createRes.statusCode, 201);
  ticketId = createRes.json().data.id;
  assert.equal(createRes.json().data.status, "OPEN");

  const queueRes = await app.inject({
    method: "GET",
    url: "/api/v1/tickets",
    headers: authHeader(support),
  });
  assert.equal(queueRes.statusCode, 200);
  assert.ok(queueRes.json().data.some((t: { id: string }) => t.id === ticketId));
});

test("support staff assigns, replies, and the ticket awaits the client", async () => {
  const assignRes = await app.inject({
    method: "POST",
    url: `/api/v1/tickets/${ticketId}/assign`,
    headers: authHeader(support),
    payload: { assignedToUserId: support.id },
  });
  assert.equal(assignRes.statusCode, 200);
  assert.equal(assignRes.json().data.status, "ASSIGNED");

  const replyRes = await app.inject({
    method: "POST",
    url: `/api/v1/tickets/${ticketId}/messages`,
    headers: authHeader(support),
    payload: { body: "Looking into this now — GST is 18% on the subtotal, can you share a screenshot?" },
  });
  assert.equal(replyRes.statusCode, 201);

  const ticketRes = await app.inject({
    method: "GET",
    url: `/api/v1/tickets/${ticketId}`,
    headers: authHeader(support),
  });
  assert.equal(ticketRes.json().data.status, "AWAITING_CLIENT");
});

test("client reply moves the ticket back to IN_PROGRESS, and resolving notifies the client", async () => {
  const clientReply = await app.inject({
    method: "POST",
    url: `/api/v1/tickets/${ticketId}/messages`,
    headers: authHeader(client),
    payload: { body: "Ah, that makes sense — thanks!" },
  });
  assert.equal(clientReply.statusCode, 201);

  const midStateRes = await app.inject({
    method: "GET",
    url: `/api/v1/tickets/${ticketId}`,
    headers: authHeader(support),
  });
  assert.equal(midStateRes.json().data.status, "IN_PROGRESS");

  const resolveRes = await app.inject({
    method: "POST",
    url: `/api/v1/tickets/${ticketId}/status`,
    headers: authHeader(support),
    payload: { status: "RESOLVED" },
  });
  assert.equal(resolveRes.statusCode, 200);
  assert.equal(resolveRes.json().data.status, "RESOLVED");

  const notifications = await app.inject({
    method: "GET",
    url: "/api/v1/notifications",
    headers: authHeader(client),
  });
  assert.ok(notifications.json().data.some((n: { type: string }) => n.type === "ticket.resolved"));
  assert.ok(notifications.json().meta.unreadCount > 0);
});

test("marking all notifications read zeroes the unread count", async () => {
  const markRes = await app.inject({
    method: "POST",
    url: "/api/v1/notifications/read-all",
    headers: authHeader(client),
  });
  assert.equal(markRes.statusCode, 200);

  const after = await app.inject({
    method: "GET",
    url: "/api/v1/notifications",
    headers: authHeader(client),
  });
  assert.equal(after.json().meta.unreadCount, 0);
});
