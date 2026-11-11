import { create } from "zustand";
import { apiRequest } from "../lib/api-client";
import { secureStorage } from "../lib/secure-storage";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  userType: "CLIENT" | "STAFF";
  staffRole?: string | null;
  status: string;
  organizations?: { id: string; name: string; role: string; approved: boolean }[];
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isHydrated: boolean;
  activeOrganizationId: string | null;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  setActiveOrganization: (id: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isHydrated: false,
  activeOrganizationId: null,

  hydrate: async () => {
    const { accessToken } = await secureStorage.getTokens();
    if (!accessToken) {
      set({ isHydrated: true });
      return;
    }
    try {
      await get().refreshMe();
    } catch {
      await secureStorage.clear();
    } finally {
      set({ isHydrated: true });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const data = await apiRequest<{
        user: AuthUser;
        accessToken: string;
        refreshToken: string;
      }>("/api/v1/auth/login", { method: "POST", body: { email, password }, auth: false });

      await secureStorage.setTokens(data.accessToken, data.refreshToken);
      set({ user: data.user });
      await get().refreshMe();
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await apiRequest("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // Even if the network call fails, clear local tokens so the user is
      // signed out of this device.
    }
    await secureStorage.clear();
    set({ user: null, activeOrganizationId: null });
  },

  refreshMe: async () => {
    const user = await apiRequest<AuthUser>("/api/v1/auth/me");
    set({
      user,
      activeOrganizationId: get().activeOrganizationId ?? user.organizations?.[0]?.id ?? null,
    });
  },

  setActiveOrganization: (id) => set({ activeOrganizationId: id }),
}));
