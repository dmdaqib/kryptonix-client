// Seed data for LOCAL/DEV environments only (rule: never seed demo data in
// production). Run with `pnpm db:seed` after `pnpm db:migrate`.

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../packages/shared/src/security/password.ts";

const prisma = new PrismaClient();

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
  const passwordHash = await hashPassword("ChangeMe123!");
  await prisma.user.upsert({
    where: { email: "admin@kryptonix.digital" },
    update: {},
    create: {
      email: "admin@kryptonix.digital",
      fullName: "KryptonIX Super Admin",
      passwordHash,
      userType: "STAFF",
      staffRole: "SUPER_ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });

  console.log("Done. Sandbox login: admin@kryptonix.digital / ChangeMe123! (DEV ONLY — change immediately in any shared environment).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
