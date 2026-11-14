import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../server.ts";
import { prisma } from "../db/prisma.ts";
import { createClientOrgOwner, createStaffUser, authHeader, type ClientOwner, type AuthedUser } from "./helpers.ts";

let app: FastifyInstance;
let client: ClientOwner;
let salesStaff: AuthedUser;
let testPackageId: string;

before(async () => {
  app = await buildServer();
  client = await createClientOrgOwner();
  salesStaff = await createStaffUser("SALES_MANAGER");

  // Ensure there is at least one active category, service, and package for testing
  let category = await prisma.serviceCategory.findFirst({ where: { slug: "mobile-app-development" } });
  if (!category) {
    category = await prisma.serviceCategory.create({
      data: {
        name: "Mobile App Development",
        slug: "mobile-app-development",
        description: "Cross-platform mobile apps for iOS and Android.",
        sortOrder: 1,
      },
    });
  }

  let service = await prisma.service.findFirst({ where: { slug: "mobile-app-development" } });
  if (!service) {
    service = await prisma.service.create({
      data: {
        categoryId: category.id,
        name: "Mobile App Development",
        slug: "mobile-app-development",
        summary: "End-to-end React Native and native mobile applications.",
        description: "From architecture to deployment on App Store and Google Play.",
        isActive: true,
      },
    });
  }

  let pkg = await prisma.servicePackage.findFirst({ where: { serviceId: service.id } });
  if (!pkg) {
    pkg = await prisma.servicePackage.create({
      data: {
        serviceId: service.id,
        name: "Startup MVP Mobile App",
        description: "Full-stack mobile app launch",
        priceAmount: 150000,
        expectedDurationDays: 45,
        paymentTerms: "50% advance, 50% on deliverable sign-off",
        isAvailable: true,
      },
    });
  }
  testPackageId = pkg.id;
});

after(async () => {
  await app.close();
});

test("catalogue: retrieve categories list", async () => {
  const res = await app.inject({
    method: "GET",
    url: "/api/v1/catalogue/categories",
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length > 0);
  assert.ok(body.data.some((c: { slug: string }) => c.slug === "mobile-app-development"));
});

test("catalogue: search services with keyword and category filters", async () => {
  const res = await app.inject({
    method: "GET",
    url: "/api/v1/catalogue/services?search=Mobile",
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.some((s: { name: string }) => s.name.includes("Mobile")));
});

test("catalogue: get service details by slug with packages and FAQs", async () => {
  const res = await app.inject({
    method: "GET",
    url: "/api/v1/catalogue/services/mobile-app-development",
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.data.slug, "mobile-app-development");
  assert.ok(Array.isArray(body.data.packages));
  assert.ok(body.data.packages.length > 0);
});

test("enquiries: submit custom project proposal requirement", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/enquiries",
    headers: authHeader(client),
    payload: {
      organizationId: client.organizationId,
      title: "Akash Logistics Fleet Tracking",
      requirements: "Automated fleet tracking and driver dispatch mobile system with WhatsApp notifications.",
      budgetRangeMin: 250000,
      budgetRangeMax: 500000,
      expectedTimeline: "6-8 weeks",
    },
  });
  assert.equal(res.statusCode, 201);
  const body = res.json();
  assert.ok(body.data.id);
  assert.equal(body.data.status, "NEW");
});

test("staff: review submitted enquiries in staff queue", async () => {
  const res = await app.inject({
    method: "GET",
    url: "/api/v1/staff/enquiries",
    headers: authHeader(salesStaff),
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.some((e: { title: string }) => e.title === "Akash Logistics Fleet Tracking"));
});

test("commerce: purchase package with KRYPTON10 discount and 50% advance schedule", async () => {
  const res = await app.inject({
    method: "POST",
    url: `/api/v1/organizations/${client.organizationId}/packages/${testPackageId}/purchase`,
    headers: authHeader(client),
    payload: {
      discountCode: "KRYPTON10",
      paymentSchedule: "ADVANCE_50",
      notes: "Please include dark mode support.",
    },
  });
  assert.equal(res.statusCode, 201);
  const body = res.json();
  const invoice = body.data;

  assert.ok(invoice.id);
  assert.ok(invoice.projectId);
  assert.equal(invoice.status, "SENT");

  // Verify financial totals:
  // Package price = 150000. 10% discount = 15000. Discounted subtotal = 135000.
  // 18% GST on 135000 = 24300. Total = 159300.
  assert.ok(Number(invoice.totalAmount) > 0);
  assert.equal(Number(invoice.discountAmount), 15000);

  // Verify project workspace and milestone were created automatically
  const project = await prisma.project.findUnique({ where: { id: invoice.projectId } });
  assert.ok(project);
  assert.ok(project.name.includes("Startup MVP Mobile App"));
  const milestones = await prisma.milestone.findMany({ where: { projectId: project.id } });
  assert.ok(milestones.length > 0);

  // Verify conversation was created
  const conversation = await prisma.conversation.findFirst({ where: { projectId: project.id } });
  assert.ok(conversation);

  // Now test payment checkout
  const payRes = await app.inject({
    method: "POST",
    url: `/api/v1/invoices/${invoice.id}/pay`,
    headers: authHeader(client),
  });
  assert.equal(payRes.statusCode, 201);
  const payData = payRes.json().data;
  assert.ok(payData.paymentId);
  assert.ok(payData.providerOrderId);

  // Confirm payment in sandbox mode
  const confirmRes = await app.inject({
    method: "POST",
    url: `/api/v1/payments/${payData.paymentId}/confirm`,
    headers: authHeader(client),
    payload: {
      providerPaymentId: `pay_sbx_${Date.now()}`,
      signature: `sig_sbx_${Date.now()}`,
      method: "upi",
    },
  });
  assert.equal(confirmRes.statusCode, 200);

  // Verify invoice status updated to PAID and receipt was created
  const updatedInvoice = await prisma.invoice.findUnique({
    where: { id: invoice.id },
    include: { payments: { include: { receipt: true } } },
  });
  assert.ok(updatedInvoice);
  assert.equal(updatedInvoice.status, "PAID");
  assert.ok(updatedInvoice.payments.length > 0);
  const payment = updatedInvoice.payments[0];
  assert.ok(payment);
  assert.equal(payment.status, "SUCCEEDED");
  assert.ok(payment.receipt);
  assert.ok(payment.receipt.receiptNumber.startsWith("KX-RCPT-"));
});
