import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../server.ts";
import { prisma } from "../db/prisma.ts";
import { env } from "../config.ts";
import { createStaffUser, authHeader, type AuthedUser } from "./helpers.ts";

let app: FastifyInstance;
let projectManager: AuthedUser;

function signWebhook(rawBody: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

before(async () => {
  app = await buildServer();
  projectManager = await createStaffUser("PROJECT_MANAGER");
});

after(async () => {
  await app.close();
});

test("complete customer lifecycle: registration to project deliverable sign-off", async () => {
  const uniqueId = Date.now().toString(36);
  const clientEmail = `client-${uniqueId}@enterprise-corp.com`;
  const clientPassword = "SecurePassword123!@";
  const orgName = `Enterprise Corp ${uniqueId}`;

  const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000);
  const clientPhone = `+91${randomDigits}`;

  // Step 1: Customer Registration
  const regRes = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: {
      email: clientEmail,
      password: clientPassword,
      fullName: "Ananya Deshmukh",
      businessName: orgName,
      businessCategory: "Information Technology",
      country: "India",
      phone: clientPhone,
    },
  });
  assert.equal(regRes.statusCode, 201);
  const regBody = regRes.json();
  assert.ok(regBody.data.userId);
  assert.ok(regBody.data.organizationId);

  const clientId = regBody.data.userId;
  const organizationId = regBody.data.organizationId;

  // Staff approves account to ACTIVE status
  await prisma.user.update({
    where: { id: clientId },
    data: { status: "ACTIVE" },
  });
  await prisma.organization.update({
    where: { id: organizationId },
    data: { approvedAt: new Date() },
  });

  // Step 2: Customer Login
  const loginRes = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: {
      email: clientEmail,
      password: clientPassword,
    },
  });
  assert.equal(loginRes.statusCode, 200);
  const loginBody = loginRes.json();
  const clientToken = loginBody.data.accessToken;
  const clientAuth = { authorization: `Bearer ${clientToken}` };

  // Step 3: Service Discovery
  const catRes = await app.inject({
    method: "GET",
    url: "/api/v1/catalogue/categories",
  });
  assert.equal(catRes.statusCode, 200);
  const categories = catRes.json().data;
  assert.ok(categories.length > 0);

  // Step 3: Service Selection
  const srvRes = await app.inject({
    method: "GET",
    url: "/api/v1/catalogue/services",
  });
  assert.equal(srvRes.statusCode, 200);
  const services = srvRes.json().data;
  assert.ok(services.length > 0);

  const targetService = services[0];
  const pkgRes = await app.inject({
    method: "GET",
    url: `/api/v1/catalogue/services/${targetService.slug}`,
  });
  assert.equal(pkgRes.statusCode, 200);
  const serviceDetail = pkgRes.json().data;
  assert.ok(serviceDetail.packages.length > 0);
  const selectedPackage = serviceDetail.packages[0];

  // Step 4: Purchase / Order Confirmation with Billing Details
  const purchaseRes = await app.inject({
    method: "POST",
    url: `/api/v1/organizations/${organizationId}/packages/${selectedPackage.id}/purchase`,
    headers: clientAuth,
    payload: {
      paymentSchedule: "FULL",
      notes: "Please deliver initial wireframes within 5 working days.",
      customerDetails: {
        businessName: orgName,
        gstin: "27AAPFU0939F1ZV",
        phone: "+91 99887 76655",
        address: "Bandra Kurla Complex, Mumbai, Maharashtra 400051",
      },
    },
  });
  assert.equal(purchaseRes.statusCode, 201);
  const purchaseData = purchaseRes.json().data;
  const invoiceId = purchaseData.id;
  const projectId = purchaseData.projectId;
  assert.ok(invoiceId);
  assert.ok(projectId);

  // Step 5: Verify persistent database state (Quote, Invoice, Project, Milestones, Conversation)
  const dbInvoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: true, project: true },
  });
  assert.ok(dbInvoice);
  assert.equal(dbInvoice.status, "SENT");
  assert.equal(dbInvoice.projectId, projectId);

  const dbProject = await prisma.project.findUnique({
    where: { id: projectId },
    include: { milestones: true, conversations: true },
  });
  assert.ok(dbProject);
  assert.equal(dbProject.organizationId, organizationId);
  assert.equal(dbProject.status, "IN_PROGRESS");
  assert.ok(dbProject.milestones.length >= 3);
  assert.ok(dbProject.conversations.length >= 1);

  const firstMilestone = dbProject.milestones[0];
  assert.ok(firstMilestone);
  const conversation = dbProject.conversations[0];
  assert.ok(conversation);

  // Step 6: Payment Gateway Order Creation
  const payRes = await app.inject({
    method: "POST",
    url: `/api/v1/invoices/${invoiceId}/pay`,
    headers: clientAuth,
  });
  assert.equal(payRes.statusCode, 201);
  const payData = payRes.json().data;
  assert.ok(payData.paymentId);
  assert.ok(payData.providerOrderId);

  // Step 7: Gateway Webhook Confirmation (payment.captured)
  const secret = env.RAZORPAY_WEBHOOK_SECRET || "rzp_test_webhook_placeholder";
  const razorpayPaymentId = `pay_${uniqueId}_captured`;
  const webhookBody = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: razorpayPaymentId,
          order_id: payData.providerOrderId,
          amount: Math.round(Number(dbInvoice.totalAmount) * 100),
          method: "netbanking",
          status: "captured",
        },
      },
    },
  });

  const webhookSignature = signWebhook(webhookBody, secret);
  const whRes = await app.inject({
    method: "POST",
    url: "/api/v1/webhooks/razorpay",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": webhookSignature,
    },
    payload: webhookBody,
  });
  assert.equal(whRes.statusCode, 200);

  // Step 8: Verify Invoice is PAID and Receipt is created in PostgreSQL
  const verifiedInvoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: { include: { receipt: true } } },
  });
  assert.ok(verifiedInvoice);
  assert.equal(verifiedInvoice.status, "PAID");
  assert.ok(verifiedInvoice.payments.length > 0);
  const paymentRecord = verifiedInvoice.payments[0];
  assert.ok(paymentRecord);
  assert.equal(paymentRecord.status, "SUCCEEDED");
  assert.ok(paymentRecord.receipt);
  assert.ok(paymentRecord.receipt.receiptNumber.startsWith("KX-RCPT-"));

  // Step 9: Client accesses Project Dashboard
  const clientProjectsRes = await app.inject({
    method: "GET",
    url: `/api/v1/organizations/${organizationId}/projects`,
    headers: clientAuth,
  });
  assert.equal(clientProjectsRes.statusCode, 200);
  const clientProjects = clientProjectsRes.json().data;
  assert.ok(clientProjects.some((p: { id: string }) => p.id === projectId));

  // Step 10: Client communicates with team in Project Chat
  const msgRes = await app.inject({
    method: "POST",
    url: `/api/v1/conversations/${conversation.id}/messages`,
    headers: clientAuth,
    payload: {
      body: "Hi team! We are excited to kickoff this project. Please find our brand guidelines attached.",
    },
  });
  assert.equal(msgRes.statusCode, 201);

  // Step 11: Project Manager uploads Deliverable
  // Ensure PM is assigned as member of project
  await prisma.projectMember.create({
    data: {
      projectId,
      userId: projectManager.id,
      isManager: true,
    },
  });

  // PM uploads file to project
  const fileRes = await app.inject({
    method: "POST",
    url: `/api/v1/projects/${projectId}/files`,
    headers: authHeader(projectManager),
    payload: {
      category: "deliverable",
      originalName: "Architecture_and_Wireframes_v1.pdf",
      storageKey: "deliverables/wireframes_v1.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4500000,
    },
  });
  assert.equal(fileRes.statusCode, 201);
  const fileId = fileRes.json().data.id;

  // PM submits deliverable for client review
  const deliverableRes = await app.inject({
    method: "POST",
    url: `/api/v1/milestones/${firstMilestone.id}/deliverables`,
    headers: authHeader(projectManager),
    payload: { fileId },
  });
  assert.equal(deliverableRes.statusCode, 201);
  const deliverable = deliverableRes.json().data;

  // Step 12: Client reviews and approves Milestone Deliverable
  const approveRes = await app.inject({
    method: "POST",
    url: `/api/v1/deliverables/${deliverable.id}/approve`,
    headers: clientAuth,
  });
  assert.equal(approveRes.statusCode, 201);

  // Step 13: Verify persistent Milestone approval in PostgreSQL
  const approvedMilestone = await prisma.milestone.findUnique({
    where: { id: firstMilestone.id },
  });
  assert.ok(approvedMilestone);
  assert.equal(approvedMilestone.status, "APPROVED");

  // Verify approval record exists in DB
  const dbApproval = await prisma.approval.findFirst({
    where: { deliverableId: deliverable.id },
  });
  assert.ok(dbApproval);
  assert.equal(dbApproval.decision, "APPROVED");
  assert.equal(dbApproval.decidedByUserId, clientId);
});
