import Constants from "expo-constants";

export type RuntimeAppEnv = "local" | "staging" | "production";

export type AppEnv = {
  appEnv: RuntimeAppEnv;
  apiBaseUrl: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseAnonKey?: string;
  posthogHost?: string;
  posthogApiKey?: string;
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

const runtimeEnv: AppEnv = {
  appEnv: requireAppEnv(extras.appEnv),
  apiBaseUrl: requireString("apiBaseUrl", extras.apiBaseUrl),
  supabaseUrl: requireString("supabaseUrl", extras.supabaseUrl),
  supabasePublishableKey: requireString(
    "supabasePublishableKey",
    extras.supabasePublishableKey ?? extras.supabaseAnonKey,
  ),
  supabaseAnonKey: optionalString(extras.supabaseAnonKey),
  posthogHost: optionalString(extras.posthogHost),
  posthogApiKey: optionalString(extras.posthogApiKey),
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
