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
