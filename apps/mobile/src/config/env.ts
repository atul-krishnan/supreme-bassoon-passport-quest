import Constants from "expo-constants";
import { Platform } from "react-native";

export type RuntimeAppEnv = "local" | "staging" | "production";

export type AppEnv = {
  appEnv: RuntimeAppEnv;
  apiBaseUrl: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseAnonKey?: string;
  posthogHost?: string;
  posthogApiKey?: string;
  googleMapsApiKey?: string;
  googleMapsAndroidApiKey?: string;
  sentryDsn?: string;
  releaseSha?: string;
  productionSupabaseProjectRef?: string;
};

function requireString(name: string, value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required Expo extra value: ${name}`);
  }
  return value;
}

function requireAppEnv(value: unknown): RuntimeAppEnv {
  if (value === "local" || value === "staging" || value === "production") {
    return value;
  }
  throw new Error("Missing or invalid Expo extra value: appEnv");
}

const extras = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeLocalhostForAndroid(url: string): string {
  if (Platform.OS !== "android") {
    return url;
  }

  return url
    .replace("http://127.0.0.1", "http://10.0.2.2")
    .replace("https://127.0.0.1", "https://10.0.2.2")
    .replace("http://localhost", "http://10.0.2.2")
    .replace("https://localhost", "https://10.0.2.2");
}

const runtimeEnv: AppEnv = {
  appEnv: requireAppEnv(extras.appEnv),
  apiBaseUrl: normalizeLocalhostForAndroid(
    requireString("apiBaseUrl", extras.apiBaseUrl),
  ),
  supabaseUrl: normalizeLocalhostForAndroid(
    requireString("supabaseUrl", extras.supabaseUrl),
  ),
  supabasePublishableKey: requireString(
    "supabasePublishableKey",
    extras.supabasePublishableKey ?? extras.supabaseAnonKey,
  ),
  supabaseAnonKey: optionalString(extras.supabaseAnonKey),
  posthogHost: optionalString(extras.posthogHost),
  posthogApiKey: optionalString(extras.posthogApiKey),
  googleMapsApiKey: optionalString(extras.googleMapsApiKey),
  googleMapsAndroidApiKey: optionalString(
    extras.googleMapsAndroidApiKey ?? extras.googleMapsApiKey,
  ),
  sentryDsn: optionalString(extras.sentryDsn),
  releaseSha: optionalString(extras.releaseSha),
  productionSupabaseProjectRef: optionalString(extras.productionSupabaseProjectRef),
};

if (
  runtimeEnv.appEnv === "staging" &&
  runtimeEnv.productionSupabaseProjectRef &&
  runtimeEnv.supabaseUrl.includes(
    `${runtimeEnv.productionSupabaseProjectRef}.supabase.co`,
  )
) {
  throw new Error("Staging app cannot target production Supabase project");
}

export const env: AppEnv = runtimeEnv;
