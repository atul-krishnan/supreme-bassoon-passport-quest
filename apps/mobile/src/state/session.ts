import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import type { CityId } from "@passport-quest/shared";

type SessionState = {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  activeCityId: CityId;
  needsOnboarding: boolean;
  isBootstrapped: boolean;
  refreshAccessToken: () => Promise<string | null>;
  bootstrapSession: () => Promise<void>;
  resetSession: () => Promise<void>;
  setCity: (cityId: CityId) => void;
  setNeedsOnboarding: (needsOnboarding: boolean) => void;
};

const ACCESS_TOKEN_KEY = "pq_access_token";
const REFRESH_TOKEN_KEY = "pq_refresh_token";
const GUEST_EMAIL_KEY = "pq_guest_email";
const GUEST_PASSWORD_KEY = "pq_guest_password";

const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

export const useSessionStore = create<SessionState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  userId: null,
  activeCityId: "blr",
  needsOnboarding: false,
  isBootstrapped: false,
  setCity: (activeCityId) => set({ activeCityId }),
  setNeedsOnboarding: (needsOnboarding) => set({ needsOnboarding }),
  resetSession: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(GUEST_EMAIL_KEY),
      SecureStore.deleteItemAsync(GUEST_PASSWORD_KEY),
    ]);

    set({
      accessToken: null,
      refreshToken: null,
      userId: null,
      needsOnboarding: false,
      isBootstrapped: false,
    });
  },
  refreshAccessToken: async () => {
    const currentRefreshToken =
      get().refreshToken ?? (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY));
    if (!currentRefreshToken) {
      return null;
    }

    const refreshResult = await supabase.auth.refreshSession({
      refresh_token: currentRefreshToken
    });
    const refreshedSession = refreshResult.data.session;
    const refreshedUserId =
      refreshResult.data.user?.id ?? refreshedSession?.user?.id;

    if (
      refreshResult.error ||
      !refreshedSession?.access_token ||
      !refreshedUserId
    ) {
      return null;
    }

    const nextRefreshToken =
      refreshedSession.refresh_token ?? currentRefreshToken;
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, refreshedSession.access_token);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, nextRefreshToken);

    set({
      accessToken: refreshedSession.access_token,
      refreshToken: nextRefreshToken,
      userId: refreshedUserId,
      isBootstrapped: true
    });

    return refreshedSession.access_token;
  },
  bootstrapSession: async () => {
    const applySession = async (
      accessToken: string,
      refreshToken: string | null,
      userId: string
    ) => {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      if (refreshToken) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      } else {
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      }
      set({
        accessToken,
        refreshToken,
        userId,
        isBootstrapped: true
      });
    };

    const localToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    const localRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

    if (localRefreshToken) {
      const refreshResult = await supabase.auth.refreshSession({
        refresh_token: localRefreshToken
      });
      const refreshedSession = refreshResult.data.session;
      const refreshedUserId =
        refreshResult.data.user?.id ?? refreshedSession?.user?.id;

      if (
        !refreshResult.error &&
        refreshedSession?.access_token &&
        refreshedUserId
      ) {
        await applySession(
          refreshedSession.access_token,
          refreshedSession.refresh_token ?? localRefreshToken,
          refreshedUserId
        );
        return;
      }

      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }

    if (localToken) {
      const user = await supabase.auth.getUser(localToken);
      if (!user.error && user.data.user) {
        await applySession(localToken, localRefreshToken, user.data.user.id);
        return;
      }

      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    }

    const signInResult = await supabase.auth.signInAnonymously();
    if (!signInResult.error && signInResult.data.session?.access_token && signInResult.data.user?.id) {
      await applySession(
        signInResult.data.session.access_token,
        signInResult.data.session.refresh_token ?? null,
        signInResult.data.user.id
      );
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
      await applySession(
        passwordSignInResult.data.session.access_token,
        passwordSignInResult.data.session.refresh_token ?? null,
        passwordSignInResult.data.user.id
      );
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

    await applySession(
      signUpResult.data.session.access_token,
      signUpResult.data.session.refresh_token ?? null,
      signUpResult.data.user.id
    );
  }
}));
