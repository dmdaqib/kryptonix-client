// Seed data for LOCAL/DEV environments only (rule: never seed demo data in
// production). Run with `pnpm db:seed` after `pnpm db:migrate`.

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../packages/shared/src/security/password.ts";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding service catalogue from kryptonix.digital's real service lines...");

  const categories = [
    { name: "Custom Software Development", slug: "custom-software" },
    { name: "Salon & Gym Management Software", slug: "salon-gym-software" },
    { name: "Website & Booking Development", slug: "websites-booking" },
    { name: "SEO", slug: "seo" },
    { name: "Google & Meta Ads", slug: "paid-ads" },
    { name: "Business Automation & AI Solutions", slug: "automation-ai" },
  ];

  for (const [i, c] of categories.entries()) {
    await prisma.serviceCategory.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, sortOrder: i },
    });
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
