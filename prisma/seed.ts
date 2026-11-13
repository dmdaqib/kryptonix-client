// Seed data for LOCAL/DEV environments only (rule: never seed demo data in
// production). Run with `pnpm db:seed` after `pnpm db:migrate`.

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../packages/shared/src/security/password.ts";

const prisma = new PrismaClient();

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function addDays(n: number) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log("Seeding service catalogue from kryptonix.digital's real service lines...");

  const categories = [
    {
      name: "Custom Software Development",
      slug: "custom-software",
      services: [
        {
          name: "Custom Web & Mobile App Development",
          slug: "custom-web-mobile-apps",
          summary: "A bespoke web or mobile application built around your workflow, not a template.",
          description:
            "End-to-end design and development of a custom web and/or mobile application — from " +
            "requirements and UX through to a production-ready build, QA and launch support.",
          packages: [
            {
              name: "Starter Build",
              description: "A focused single-platform app (web OR mobile) covering your core workflow.",
              priceAmount: 75000,
              expectedDurationDays: 30,
              features: ["Single platform (web or mobile)", "Up to 6 core screens/flows", "2 rounds of revisions", "30 days post-launch support"],
            },
            {
              name: "Full Platform Build",
              description: "Web + mobile apps sharing one backend, built for scale from day one.",
              priceAmount: 180000,
              expectedDurationDays: 60,
              features: ["Web + mobile apps", "Shared backend & admin dashboard", "Unlimited core-flow screens", "90 days post-launch support"],
            },
          ],
        },
      ],
    },
    {
      name: "Salon & Gym Management Software",
      slug: "salon-gym-software",
      services: [
        {
          name: "Salon & Gym Management Platform",
          slug: "salon-gym-platform",
          summary: "Bookings, staff rosters, memberships and billing in one dashboard.",
          description:
            "A management platform tailored to salons and gyms: appointment/class booking, staff " +
            "scheduling, membership and package tracking, and billing — with a client-facing booking app.",
          packages: [
            {
              name: "Single Location",
              description: "Everything one salon or gym needs to run bookings and memberships online.",
              priceAmount: 45000,
              expectedDurationDays: 21,
              features: ["Online booking page", "Staff & class scheduling", "Membership/package tracking", "Client booking app"],
            },
          ],
        },
      ],
    },
    {
      name: "Website & Booking Development",
      slug: "websites-booking",
      services: [
        {
          name: "Business Website with Online Booking",
          slug: "business-website-booking",
          summary: "A fast, modern website with built-in online booking or lead capture.",
          description:
            "A professionally designed business website — built for speed and conversions — with an " +
            "integrated booking or enquiry flow so visitors can act immediately, not just browse.",
          packages: [
            {
              name: "Essentials",
              description: "A clean multi-page site with a booking or enquiry form built in.",
              priceAmount: 25000,
              expectedDurationDays: 14,
              features: ["Up to 6 pages", "Mobile-first responsive design", "Booking/enquiry form", "Basic on-page SEO setup"],
            },
          ],
        },
      ],
    },
    {
      name: "SEO",
      slug: "seo",
      services: [
        {
          name: "SEO Growth Package",
          slug: "seo-growth",
          summary: "Ongoing technical, on-page and content SEO to grow organic search traffic.",
          description:
            "A monthly SEO engagement covering technical audits, on-page optimization, content " +
            "strategy and reporting, focused on measurable ranking and traffic growth.",
          packages: [
            {
              name: "Monthly Growth",
              description: "Ongoing SEO work with monthly ranking and traffic reporting.",
              priceAmount: 18000,
              taxPercent: 18,
              paymentTerms: "Billed monthly",
              expectedDurationDays: 30,
              features: ["Technical SEO audit", "On-page optimization", "Monthly content plan", "Monthly ranking report"],
            },
          ],
        },
      ],
    },
    {
      name: "Google & Meta Ads",
      slug: "paid-ads",
      services: [
        {
          name: "Google & Meta Ads Management",
          slug: "google-meta-ads",
          summary: "Campaign setup and ongoing management across Google and Meta.",
          description:
            "End-to-end paid campaign management across Google Search/Display and Meta (Facebook/" +
            "Instagram) — audience research, creative guidance, campaign setup and ongoing optimization.",
          packages: [
            {
              name: "Monthly Management",
              description: "Campaign management fee — ad spend is billed separately to your own ad accounts.",
              priceAmount: 15000,
              taxPercent: 18,
              paymentTerms: "Billed monthly, ad spend separate",
              expectedDurationDays: 30,
              features: ["Campaign setup across Google & Meta", "Audience & keyword research", "Weekly optimization", "Monthly performance report"],
            },
          ],
        },
      ],
    },
    {
      name: "Business Automation & AI Solutions",
      slug: "automation-ai",
      services: [
        {
          name: "AI Workflow Automation",
          slug: "ai-workflow-automation",
          summary: "Automate repetitive business workflows with custom scripts, bots and AI tools.",
          description:
            "We map your repetitive manual workflows (lead handling, reporting, support replies, " +
            "data entry) and automate them with custom scripts, integrations and AI-assisted tools.",
          packages: [
            {
              name: "Process Audit & Automation",
              description: "We audit up to 3 workflows and automate the highest-impact ones.",
              priceAmount: 35000,
              expectedDurationDays: 21,
              features: ["Workflow audit (up to 3 processes)", "Custom automation build", "Team handover & training", "30 days support"],
            },
          ],
        },
      ],
    },
  ];

  for (const [i, c] of categories.entries()) {
    const category = await prisma.serviceCategory.upsert({
      where: { slug: c.slug },
      update: {},
      create: { name: c.name, slug: c.slug, sortOrder: i },
    });

    for (const s of c.services) {
      const service = await prisma.service.upsert({
        where: { slug: s.slug },
        update: {},
        create: {
          categoryId: category.id,
          name: s.name,
          slug: s.slug,
          summary: s.summary,
          description: s.description,
        },
      });

      for (const p of s.packages) {
        const existing = await prisma.servicePackage.findFirst({
          where: { serviceId: service.id, name: p.name },
        });
        if (existing) continue;

        await prisma.servicePackage.create({
          data: {
            serviceId: service.id,
            name: p.name,
            description: p.description,
            priceAmount: p.priceAmount,
            taxPercent: p.taxPercent ?? 0,
            paymentTerms: p.paymentTerms,
            expectedDurationDays: p.expectedDurationDays,
            features: { create: p.features.map((label) => ({ label, included: true })) },
          },
        });
      }
    }
  }

  console.log("Seeding a sandbox Super Admin staff account...");
  const adminPasswordHash = await hashPassword("ChangeMe123!");
  const admin = await prisma.user.upsert({
    where: { email: "admin@kryptonix.digital" },
    update: {},
    create: {
      email: "admin@kryptonix.digital",
      fullName: "KryptonIX Super Admin",
      passwordHash: adminPasswordHash,
      userType: "STAFF",
      staffRole: "SUPER_ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });

  console.log("Seeding a fully populated demo client account...");
  const demoPasswordHash = await hashPassword("Demo1234!");
  const demoClient = await prisma.user.upsert({
    where: { email: "demo@kryptonix.digital" },
    update: {},
    create: {
      email: "demo@kryptonix.digital",
      phone: "9900011122",
      fullName: "Aisha Khan",
      passwordHash: demoPasswordHash,
      userType: "CLIENT",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });

  // Everything below is keyed off whether this demo user already has an
  // organization — safe to re-run `pnpm db:seed` any number of times.
  const alreadySeeded = await prisma.organizationMember.findFirst({
    where: { userId: demoClient.id },
  });

  if (!alreadySeeded) {
    const salonService = await prisma.service.findUnique({
      where: { slug: "salon-gym-platform" },
      include: { packages: true },
    });
    const salonPackage = salonService?.packages[0];

    const org = await prisma.organization.create({
      data: {
        name: "Bloom & Co. Salon",
        businessCategory: "Salon",
        website: "https://bloomandco.example.com",
        country: "India",
        approvedAt: new Date(),
        approvedByUserId: admin.id,
      },
    });

    await prisma.organizationMember.create({
      data: { organizationId: org.id, userId: demoClient.id, role: "OWNER" },
    });

    const enquiry = await prisma.enquiry.create({
      data: {
        organizationId: org.id,
        createdByUserId: demoClient.id,
        serviceId: salonService?.id,
        title: "Online booking + membership system for our salon chain",
        requirements:
          "We run 2 salon locations and need online appointment booking, staff rosters and " +
          "membership/package tracking in one place, with a simple app our clients can book from.",
        budgetRangeMin: 40000,
        budgetRangeMax: 60000,
        expectedTimeline: "4-6 weeks",
        status: "CONVERTED",
      },
    });

    let quote: { id: string } | null = null;
    if (salonPackage) {
      const subtotal = salonPackage.priceAmount;
      const tax = Number(subtotal) * 0.18;
      const total = Number(subtotal) + tax;

      quote = await prisma.quote.create({
        data: {
          organizationId: org.id,
          enquiryId: enquiry.id,
          createdByUserId: admin.id,
          quoteNumber: "Q-DEMO-0001",
          status: "ACCEPTED",
          scopeOfWork: salonService!.description,
          subtotalAmount: subtotal,
          taxAmount: tax,
          totalAmount: total,
          paymentTerms: "50% upfront, 50% on delivery",
          validUntil: addDays(14),
          sentAt: daysAgo(10),
          viewedAt: daysAgo(9),
          items: {
            create: [
              {
                packageId: salonPackage.id,
                description: `${salonService!.name} — ${salonPackage.name}`,
                quantity: 1,
                unitPrice: subtotal,
                lineTotal: subtotal,
              },
            ],
          },
        },
      });

      await prisma.quoteAcceptance.create({
        data: {
          quoteId: quote.id,
          acceptedByUserId: demoClient.id,
          acceptedQuoteVersion: 1,
          acceptedAt: daysAgo(8),
        },
      });
    }

    const project = await prisma.project.create({
      data: {
        organizationId: org.id,
        quoteId: quote?.id,
        name: "Bloom & Co. — Salon & Gym Management Platform",
        description: "Online booking, staff scheduling and membership tracking for 2 salon locations.",
        serviceCategory: "salon-gym-software",
        status: "IN_PROGRESS",
        startDate: daysAgo(7),
        expectedDeliveryDate: addDays(14),
      },
    });

    await prisma.projectMember.createMany({
      data: [
        { projectId: project.id, userId: demoClient.id, isManager: false },
        { projectId: project.id, userId: admin.id, isManager: true },
      ],
    });

    const discoveryMilestone = await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: "Discovery & Design",
        description: "Requirements workshop, information architecture and UI wireframes.",
        startDate: daysAgo(7),
        dueDate: daysAgo(2),
        status: "COMPLETED",
        requiresClientApproval: true,
      },
    });

    const wireframesFile = await prisma.file.create({
      data: {
        organizationId: org.id,
        projectId: project.id,
        uploadedByUserId: admin.id,
        category: "deliverable",
        originalName: "bloom-co-wireframes-v1.pdf",
        storageKey: "seed/demo/bloom-co-wireframes-v1.pdf",
        mimeType: "application/pdf",
        sizeBytes: 248_000,
        visibility: "CLIENT_VISIBLE",
      },
    });

    const deliverable = await prisma.deliverable.create({
      data: {
        milestoneId: discoveryMilestone.id,
        fileId: wireframesFile.id,
        submittedByUserId: admin.id,
        submittedAt: daysAgo(3),
      },
    });

    await prisma.approval.create({
      data: {
        deliverableId: deliverable.id,
        decidedByUserId: demoClient.id,
        decision: "APPROVED",
        feedback: "Looks great — approved to move into build.",
        decidedAt: daysAgo(2),
      },
    });

    const buildMilestone = await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: "Booking & Membership Build",
        description: "Build the booking flow, staff scheduling and membership/package tracking.",
        startDate: daysAgo(2),
        dueDate: addDays(12),
        status: "IN_PROGRESS",
        requiresClientApproval: true,
      },
    });

    await prisma.projectTask.createMany({
      data: [
        { projectId: project.id, milestoneId: buildMilestone.id, title: "Build staff scheduling module", status: "IN_PROGRESS" },
        { projectId: project.id, milestoneId: buildMilestone.id, title: "Integrate online booking widget", status: "TODO" },
        { projectId: project.id, milestoneId: buildMilestone.id, title: "Membership/package tracking screens", status: "TODO" },
      ],
    });

    await prisma.projectUpdate.create({
      data: {
        projectId: project.id,
        authorId: admin.id,
        body: "Kickoff call completed and wireframes approved — the build phase is now underway.",
        createdAt: daysAgo(2),
      },
    });

    const conversation = await prisma.conversation.create({
      data: { projectId: project.id, title: "Project Chat" },
    });
    await prisma.conversationMember.createMany({
      data: [
        { conversationId: conversation.id, userId: demoClient.id },
        { conversationId: conversation.id, userId: admin.id },
      ],
    });
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: admin.id,
        body: "Welcome! We'll keep all project updates and files here.",
        createdAt: daysAgo(7),
      },
    });

    if (quote && salonPackage) {
      const subtotal = salonPackage.priceAmount;
      const tax = Number(subtotal) * 0.18;
      const total = Number(subtotal) + tax;

      const invoice = await prisma.invoice.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          quoteId: quote.id,
          invoiceNumber: "INV-DEMO-0001",
          status: "PAID",
          issueDate: daysAgo(7),
          dueDate: daysAgo(0),
          subtotalAmount: subtotal,
          taxAmount: tax,
          totalAmount: total,
          amountPaid: total,
          paymentTerms: "50% upfront, 50% on delivery",
          items: {
            create: [
              {
                description: `${salonService!.name} — ${salonPackage.name}`,
                quantity: 1,
                unitPrice: subtotal,
                taxPercent: 18,
                lineTotal: subtotal,
              },
            ],
          },
        },
      });

      const payment = await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          provider: "razorpay",
          providerOrderId: "order_demo_0001",
          providerPaymentId: "pay_demo_0001",
          amount: total,
          method: "upi",
          status: "SUCCEEDED",
          recordedByUserId: admin.id,
          createdAt: daysAgo(6),
        },
      });

      await prisma.receipt.create({
        data: { paymentId: payment.id, receiptNumber: "RCPT-DEMO-0001" },
      });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        organizationId: org.id,
        openedByUserId: demoClient.id,
        assignedToUserId: admin.id,
        category: "Billing",
        subject: "Question about the next payment",
        description: "When is the remaining balance due, and can I pay by card instead of UPI?",
        status: "AWAITING_CLIENT",
        priority: "NORMAL",
        createdAt: daysAgo(1),
      },
    });
    await prisma.ticketMessage.createMany({
      data: [
        {
          ticketId: ticket.id,
          authorId: demoClient.id,
          body: "When is the remaining balance due, and can I pay by card instead of UPI?",
          createdAt: daysAgo(1),
        },
        {
          ticketId: ticket.id,
          authorId: admin.id,
          body: "The remaining balance is due on project completion, and yes — card payments work too.",
          createdAt: daysAgo(1),
        },
      ],
    });

    await prisma.notification.createMany({
      data: [
        {
          userId: demoClient.id,
          type: "project.milestone_approved",
          title: "Milestone approved",
          body: "Discovery & Design was approved — build has started.",
          readAt: daysAgo(2),
          createdAt: daysAgo(2),
        },
        {
          userId: demoClient.id,
          type: "payment.succeeded",
          title: "Payment received",
          body: "We received your payment of ₹53,100 for invoice INV-DEMO-0001.",
          readAt: daysAgo(6),
          createdAt: daysAgo(6),
        },
        {
          userId: demoClient.id,
          type: "ticket.reply",
          title: "New reply on your support ticket",
          body: "KryptonIX Support replied to \"Question about the next payment\".",
          createdAt: daysAgo(1),
        },
      ],
    });
  }

  console.log("Done.");
  console.log("Sandbox admin login: admin@kryptonix.digital / ChangeMe123!");
  console.log("Fully populated demo client login: demo@kryptonix.digital / Demo1234!");
  console.log("(DEV ONLY — change these immediately in any shared environment.)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
