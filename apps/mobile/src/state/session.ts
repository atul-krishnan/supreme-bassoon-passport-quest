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
const GUEST_EMAIL_KEY = "pq_guest_email";
const GUEST_PASSWORD_KEY = "pq_guest_password";

const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
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
    const applySession = async (accessToken: string, userId: string) => {
      await SecureStore.setItemAsync(SESSION_KEY, accessToken);
      set({
        accessToken,
        userId,
        isBootstrapped: true
      });
    };

    const localToken = await SecureStore.getItemAsync(SESSION_KEY);

    if (localToken) {
      const user = await supabase.auth.getUser(localToken);
      if (!user.error && user.data.user) {
        await applySession(localToken, user.data.user.id);
        return;
      }
    }

    const signInResult = await supabase.auth.signInAnonymously();
    if (!signInResult.error && signInResult.data.session?.access_token && signInResult.data.user?.id) {
      await applySession(signInResult.data.session.access_token, signInResult.data.user.id);
      return;
    }

    const authErrorMessage = signInResult.error?.message ?? "Anonymous sign-in failed";
    const isAnonymousDisabled = authErrorMessage.toLowerCase().includes("anonymous sign-ins are disabled");
    if (!isAnonymousDisabled) {
      throw new Error(authErrorMessage);
    }

    let guestEmail = await SecureStore.getItemAsync(GUEST_EMAIL_KEY);
    let guestPassword = await SecureStore.getItemAsync(GUEST_PASSWORD_KEY);
    if (!guestEmail || !guestPassword) {
      const entropy = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      guestEmail = `guest_${entropy}@passportquest.local`;
      guestPassword = `PQ_guest_${entropy}`;
      await SecureStore.setItemAsync(GUEST_EMAIL_KEY, guestEmail);
      await SecureStore.setItemAsync(GUEST_PASSWORD_KEY, guestPassword);
    }

    const passwordSignInResult = await supabase.auth.signInWithPassword({
      email: guestEmail,
      password: guestPassword
    });
    if (!passwordSignInResult.error && passwordSignInResult.data.session?.access_token && passwordSignInResult.data.user?.id) {
      await applySession(passwordSignInResult.data.session.access_token, passwordSignInResult.data.user.id);
      return;
    }

    const signUpResult = await supabase.auth.signUp({
      email: guestEmail,
      password: guestPassword
    });
    if (signUpResult.error || !signUpResult.data.session?.access_token || !signUpResult.data.user?.id) {
      throw new Error(
        `Guest sign-in failed. Enable anonymous auth or email signup. Cause: ${
          signUpResult.error?.message ?? authErrorMessage
        }`
      );
    }

    await applySession(signUpResult.data.session.access_token, signUpResult.data.user.id);
  }
}));
