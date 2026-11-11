import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config.ts";
import { registerErrorHandler } from "./plugins/error-handler.ts";
import { authPlugin } from "./plugins/auth.ts";
import { authRoutes } from "./modules/auth/auth.routes.ts";
import { organizationRoutes } from "./modules/organizations/organizations.routes.ts";
import { invitationRoutes } from "./modules/invitations/invitations.routes.ts";
import { catalogueRoutes } from "./modules/catalogue/catalogue.routes.ts";
import { enquiryRoutes } from "./modules/sales/enquiries.routes.ts";
import { quoteRoutes } from "./modules/sales/quotes.routes.ts";
import { invoiceRoutes } from "./modules/payments/invoices.routes.ts";
import { paymentRoutes } from "./modules/payments/payments.routes.ts";
import { refundRoutes } from "./modules/payments/refunds.routes.ts";
import { webhookRoutes } from "./modules/payments/webhook.routes.ts";
import { projectRoutes } from "./modules/projects/projects.routes.ts";
import { messagingRoutes } from "./modules/projects/messaging.routes.ts";
import { fileRoutes } from "./modules/projects/files.routes.ts";
import { ticketRoutes } from "./modules/support/tickets.routes.ts";
import { notificationRoutes } from "./modules/notifications/notifications.routes.ts";

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
    },
    trustProxy: true,
  });

  registerErrorHandler(app);

  await app.register(helmet);
  await app.register(cors, {
    origin: env.NODE_ENV === "production" ? [env.CLIENT_WEB_URL] : true,
    credentials: true,
  });
  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
  });

  await app.register(authPlugin);

  app.get("/health", async () => ({ status: "ok", time: new Date().toISOString() }));

  // Webhook routes are registered in their own encapsulated context FIRST
  // and in isolation, because they install a custom content-type parser
  // (to capture the raw body for signature verification) that must not
  // leak onto the rest of the API's normal JSON parsing.
  await app.register(webhookRoutes, { prefix: "/api/v1" });

  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: "/auth" });
      await api.register(organizationRoutes);
      await api.register(invitationRoutes);
      await api.register(catalogueRoutes);
      await api.register(enquiryRoutes);
      await api.register(quoteRoutes);
      await api.register(invoiceRoutes);
      await api.register(paymentRoutes);
      await api.register(refundRoutes);
      await api.register(projectRoutes);
      await api.register(messagingRoutes);
      await api.register(fileRoutes);
      await api.register(ticketRoutes);
      await api.register(notificationRoutes);
    },
    { prefix: "/api/v1" },
  );

  return app;
}
