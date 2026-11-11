import Constants from "expo-constants";
import { secureStorage } from "./secure-storage";

const API_BASE_URL = (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const { refreshToken } = await secureStorage.getTokens();
  if (!refreshToken) return null;

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

  let res = await doFetch();

  // One silent refresh-and-retry on a 401, so a merely-expired access token
  // never surfaces as a login prompt mid-session.
  if (res.status === 401 && auth) {
    refreshPromise ??= doRefresh().finally(() => {
      refreshPromise = null;
    });
    const newToken = await refreshPromise;
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      res = await doFetch();
    }
  }

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, payload?.error?.message ?? "Request failed", payload?.error?.code);
  }

  return payload.data as T;
}
