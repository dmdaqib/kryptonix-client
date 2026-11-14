import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import { env } from "../../config.ts";

interface StorageQuery {
  key?: string;
  exp?: string;
  sig?: string;
}

function verifyHmac(prefix: string, key: string, expStr: string, sig: string): boolean {
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expectedSig = crypto
    .createHmac("sha256", env.JWT_ACCESS_SECRET)
    .update(`${prefix}:${key}:${exp}`)
    .digest("hex");

  if (sig.length !== expectedSig.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(sig, "utf-8"), Buffer.from(expectedSig, "utf-8"));
}

export async function storageRoutes(app: FastifyInstance) {
  // Catch all content types for local file upload without JSON parsing
  app.addContentTypeParser("*", (_req, _payload, done) => {
    done(null, null);
  });

  app.put("/storage/upload", async (request, reply) => {
    const query = request.query as StorageQuery;
    const { key, exp, sig } = query;

    if (!key || !exp || !sig) {
      return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Missing storage parameters" } });
    }

    if (key.includes("..") || path.isAbsolute(key)) {
      return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid storage key path" } });
    }

    if (!verifyHmac("upload", key, exp, sig)) {
      return reply.status(403).send({ error: { code: "FORBIDDEN", message: "Invalid or expired upload signature" } });
    }

    const storageRoot = path.resolve(env.STORAGE_LOCAL_PATH);
    const targetPath = path.join(storageRoot, key);

    // Guard against directory traversal outside storage root
    if (!targetPath.startsWith(storageRoot)) {
      return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid target path" } });
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const writeStream = fs.createWriteStream(targetPath);

    await pipeline(request.raw, writeStream);

    return reply.status(200).send({ data: { ok: true, key } });
  });

  app.get("/storage/download", async (request, reply) => {
    const query = request.query as StorageQuery;
    const { key, exp, sig } = query;

    if (!key || !exp || !sig) {
      return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Missing storage parameters" } });
    }

    if (key.includes("..") || path.isAbsolute(key)) {
      return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid storage key path" } });
    }

    if (!verifyHmac("download", key, exp, sig)) {
      return reply.status(403).send({ error: { code: "FORBIDDEN", message: "Invalid or expired download signature" } });
    }

    const storageRoot = path.resolve(env.STORAGE_LOCAL_PATH);
    const targetPath = path.join(storageRoot, key);

    if (!targetPath.startsWith(storageRoot) || !fs.existsSync(targetPath)) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "File not found in storage" } });
    }

    const stat = fs.statSync(targetPath);
    reply.header("Content-Length", stat.size);
    reply.header("Content-Type", "application/octet-stream");
    reply.header("Content-Disposition", `attachment; filename="${path.basename(key)}"`);

    return reply.send(fs.createReadStream(targetPath));
  });
}

