import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import type { CityId } from "@passport-quest/shared";

type SessionState = {
  accessToken: string | null;
  userId: string | null;
  activeCityId: CityId;
  isBootstrapped: boolean;
  bootstrapSession: () => Promise<void>;
  setCity: (cityId: CityId) => void;
};

const SESSION_KEY = "pq_access_token";

const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: {
      getItem: SecureStore.getItemAsync,
      setItem: SecureStore.setItemAsync,
      removeItem: SecureStore.deleteItemAsync
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  userId: null,
  activeCityId: "blr",
  isBootstrapped: false,
  setCity: (activeCityId) => set({ activeCityId }),
  bootstrapSession: async () => {
    const localToken = await SecureStore.getItemAsync(SESSION_KEY);

    if (localToken) {
      const user = await supabase.auth.getUser(localToken);
      if (!user.error && user.data.user) {
        set({
          accessToken: localToken,
          userId: user.data.user.id,
          isBootstrapped: true
        });
        return;
      }
    }

    const signInResult = await supabase.auth.signInAnonymously();
    if (signInResult.error || !signInResult.data.session?.access_token || !signInResult.data.user?.id) {
      throw new Error(signInResult.error?.message ?? "Anonymous sign-in failed");
    }

    await SecureStore.setItemAsync(SESSION_KEY, signInResult.data.session.access_token);
    set({
      accessToken: signInResult.data.session.access_token,
      userId: signInResult.data.user.id,
      isBootstrapped: true
    });
  }
}));
