import Constants from "expo-constants";
import { secureStorage } from "./secure-storage";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = "ApiError";
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function isApiError(err: unknown): err is ApiError {
  return (
    err instanceof ApiError ||
    (typeof err === "object" && err !== null && (err as { name?: string }).name === "ApiError")
  );
}

export function getApiBaseUrl(): string {
  // 1. Explicit EXPO_PUBLIC_API_BASE_URL from apps/mobile/.env
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl) {
    // If envUrl is localhost/127.0.0.1 and running in dev on a real device,
    // automatically map to Metro hostUri if available
    if (__DEV__ && (envUrl.includes("localhost") || envUrl.includes("127.0.0.1"))) {
      const hostUri = Constants.expoConfig?.hostUri;
      if (hostUri) {
        const host = hostUri.split(":")[0];
        if (host && host !== "localhost" && host !== "127.0.0.1") {
          return `http://${host}:4000`;
        }
      }
    }
    return envUrl;
  }

  // 2. In development mode with Metro, dynamically use the host machine's LAN IP
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(":")[0];
      if (host) {
        return `http://${host}:4000`;
      }
    }
    // Verified fallback Wi-Fi IP for this development workstation
    return "http://192.168.0.115:4000";
  }

  // 3. Fall back to app.json configuration for production builds
  return (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? "https://api.kryptonix.digital";
}

export const API_BASE_URL = getApiBaseUrl();

let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const { refreshToken } = await secureStorage.getTokens();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      await secureStorage.clear();
      return null;
    }
    const { data } = await res.json();
    await secureStorage.setTokens(data.accessToken, data.refreshToken);
    return data.accessToken as string;
  } catch {
    return null;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean; // default true
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (auth) {
    const { accessToken } = await secureStorage.getTokens();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }

  const doFetch = () =>
    fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

  let res: Response;
  try {
    res = await doFetch();
  } catch (err: unknown) {
    const errorDetails = err instanceof Error ? err.message : String(err);
    throw new ApiError(
      0,
      `Cannot connect to server at ${API_BASE_URL}. (${errorDetails}). Please verify your network connection and server status.`,
      "NETWORK_ERROR"
    );
  }

  // One silent refresh-and-retry on a 401, so a merely-expired access token
  // never surfaces as a login prompt mid-session.
  if (res.status === 401 && auth) {
    refreshPromise ??= doRefresh().finally(() => {
      refreshPromise = null;
    });
    const newToken = await refreshPromise;
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      try {
        res = await doFetch();
      } catch (err: unknown) {
        const errorDetails = err instanceof Error ? err.message : String(err);
        throw new ApiError(
          0,
          `Cannot connect to server at ${API_BASE_URL}. (${errorDetails}). Please verify your network connection.`,
          "NETWORK_ERROR"
        );
      }
    }
  }

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    let message = payload?.error?.message;
    if (!message) {
      if (res.status === 401) {
        message = "Invalid email or password";
      } else if (res.status === 400) {
        message = "Invalid request details. Please check your input.";
      } else if (res.status === 429) {
        message = "Too many attempts. Please wait a few minutes before trying again.";
      } else if (res.status >= 500) {
        message = "Server error occurred. Please try again later.";
      } else {
        message = `Request failed with status ${res.status}`;
      }
    }
    throw new ApiError(res.status, message, payload?.error?.code);
  }

  return payload.data as T;
}
