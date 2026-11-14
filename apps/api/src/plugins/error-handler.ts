import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

export class HttpError extends Error {
  // Deliberately NOT using TypeScript parameter-property shorthand
  // (`constructor(public statusCode: number, ...)`) here: Node's
  // `--experimental-strip-types` (used to run apps/api's own test suite
  // with zero installed dependencies — see package.json's "test" script)
  // only strips type annotations syntactically and does not support that
  // shorthand, even though `tsc` itself accepts it fine. This bit CI the
  // moment a real test file actually imported this module — see the
  // integration test suite under src/test.
  statusCode: number;
  code: string;

  constructor(statusCode: number, message: string, code = "ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized") {
    super(401, message, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden") {
    super(403, message, "FORBIDDEN");
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found") {
    super(404, message, "NOT_FOUND");
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Conflict") {
    super(409, message, "CONFLICT");
  }
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid request", details: error.flatten() },
      });
    }

    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }

    // Fastify's own framework-level errors (malformed JSON body, payload too
    // large, unsupported content-type, etc.) carry a real statusCode/code of
    // their own and are safe to pass through as-is — only truly unexpected
    // (likely 5xx) errors should be flattened to a generic message.
    const fastifyStatus = (error as { statusCode?: number }).statusCode;
    if (typeof fastifyStatus === "number" && fastifyStatus >= 400 && fastifyStatus < 500) {
      const errObj = error as { code?: string; message?: string };
      return reply.status(fastifyStatus).send({
        error: { code: errObj.code ?? "BAD_REQUEST", message: errObj.message ?? "Bad request" },
      });
    }

    request.log.error({ err: error }, "Unhandled error");
    // Never leak internals in the response — log the real error, return a
    // generic message to the client.
    return reply.status(500).send({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });
}
