import crypto from "node:crypto";
import { env } from "../config.ts";

export interface PresignUploadInput {
  organizationId: string;
  projectId: string;
  filename: string;
  mimeType: string;
  sizeBytes?: number;
}

export interface PresignUploadResult {
  uploadUrl: string;
  storageKey: string;
  method: "PUT" | "POST";
  headers?: Record<string, string>;
  expiresInSeconds: number;
}

export interface PresignDownloadResult {
  downloadUrl: string;
  expiresInSeconds: number;
}

export interface StorageProvider {
  createPresignedUploadUrl(input: PresignUploadInput): Promise<PresignUploadResult>;
  createPresignedDownloadUrl(storageKey: string): Promise<PresignDownloadResult>;
}

/**
 * Signs an S3 / Cloudflare R2 SigV4 URL without requiring heavy external SDKs.
 */
function signS3V4Url(params: {
  method: "GET" | "PUT";
  endpoint: string;
  bucket: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  expiresInSeconds: number;
}): string {
  const { method, endpoint, bucket, key, accessKeyId, secretAccessKey, region, expiresInSeconds } = params;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.substring(0, 8);

  const cleanEndpoint = endpoint.replace(/\/+$/, "");
  const cleanKey = key.replace(/^\/+/, "");
  // Cloudflare R2 path style vs virtual host style
  const host = new URL(cleanEndpoint).host;
  const path = `/${bucket}/${cleanKey}`;
  const service = "s3";

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const queryParams: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  };

  const canonicalQuery = Object.entries(queryParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    method,
    path,
    canonicalQuery,
    canonicalHeaders,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const canonicalRequestHash = crypto
    .createHash("sha256")
    .update(canonicalRequest, "utf8")
    .digest("hex");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  // Derive signing key
  const kDate = crypto.createHmac("sha256", `AWS4${secretAccessKey}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac("sha256", kDate).update(region).digest();
  const kService = crypto.createHmac("sha256", kRegion).update(service).digest();
  const kSigning = crypto.createHmac("sha256", kService).update("aws4_request").digest();

  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  return `${cleanEndpoint}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export class S3StorageProvider implements StorageProvider {
  private bucket: string;
  private endpoint: string;
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private ttlSeconds: number;

  constructor() {
    this.bucket = env.S3_BUCKET || "kryptonix-deliverables";
    this.endpoint = env.S3_ENDPOINT || "https://auto.r2.cloudflarestorage.com";
    this.region = env.S3_REGION || "auto";
    this.accessKeyId = env.S3_ACCESS_KEY_ID || "placeholder_access_key";
    this.secretAccessKey = env.S3_SECRET_ACCESS_KEY || "placeholder_secret_key";
    this.ttlSeconds = env.SIGNED_URL_TTL_SECONDS || 300;
  }

  async createPresignedUploadUrl(input: PresignUploadInput): Promise<PresignUploadResult> {
    const cleanFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const unique = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const storageKey = `projects/${input.projectId}/${unique}-${cleanFilename}`;

    const uploadUrl = signS3V4Url({
      method: "PUT",
      endpoint: this.endpoint,
      bucket: this.bucket,
      key: storageKey,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: this.region,
      expiresInSeconds: this.ttlSeconds,
    });

    return {
      uploadUrl,
      storageKey,
      method: "PUT",
      headers: {
        "Content-Type": input.mimeType,
      },
      expiresInSeconds: this.ttlSeconds,
    };
  }

  async createPresignedDownloadUrl(storageKey: string): Promise<PresignDownloadResult> {
    const downloadUrl = signS3V4Url({
      method: "GET",
      endpoint: this.endpoint,
      bucket: this.bucket,
      key: storageKey,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: this.region,
      expiresInSeconds: this.ttlSeconds,
    });

    return {
      downloadUrl,
      expiresInSeconds: this.ttlSeconds,
    };
  }
}

export class LocalStorageProvider implements StorageProvider {
  private ttlSeconds: number;

  constructor() {
    this.ttlSeconds = env.SIGNED_URL_TTL_SECONDS || 300;
  }

  async createPresignedUploadUrl(input: PresignUploadInput): Promise<PresignUploadResult> {
    const cleanFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const unique = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const storageKey = `projects/${input.projectId}/${unique}-${cleanFilename}`;

    const exp = Math.floor(Date.now() / 1000) + this.ttlSeconds;
    const sig = crypto
      .createHmac("sha256", env.JWT_ACCESS_SECRET)
      .update(`upload:${storageKey}:${exp}`)
      .digest("hex");

    const uploadUrl = `${env.API_BASE_URL}/api/v1/storage/upload?key=${encodeURIComponent(storageKey)}&exp=${exp}&sig=${sig}`;

    return {
      uploadUrl,
      storageKey,
      method: "PUT",
      headers: {
        "Content-Type": input.mimeType,
      },
      expiresInSeconds: this.ttlSeconds,
    };
  }

  async createPresignedDownloadUrl(storageKey: string): Promise<PresignDownloadResult> {
    const exp = Math.floor(Date.now() / 1000) + this.ttlSeconds;
    const sig = crypto
      .createHmac("sha256", env.JWT_ACCESS_SECRET)
      .update(`download:${storageKey}:${exp}`)
      .digest("hex");

    const downloadUrl = `${env.API_BASE_URL}/api/v1/storage/download?key=${encodeURIComponent(storageKey)}&exp=${exp}&sig=${sig}`;

    return {
      downloadUrl,
      expiresInSeconds: this.ttlSeconds,
    };
  }
}

let cachedProvider: StorageProvider | undefined;

export function getStorageProvider(): StorageProvider {
  if (!cachedProvider) {
    if (env.STORAGE_PROVIDER === "s3") {
      cachedProvider = new S3StorageProvider();
    } else {
      cachedProvider = new LocalStorageProvider();
    }
  }
  return cachedProvider;
}
