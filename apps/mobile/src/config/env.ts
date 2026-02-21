import Constants from "expo-constants";

export type AppEnv = {
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  posthogHost?: string;
  posthogApiKey?: string;
};

function requireString(name: string, value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required Expo extra value: ${name}`);
  }
  return value;
}

const extras = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const env: AppEnv = {
  apiBaseUrl: requireString("apiBaseUrl", extras.apiBaseUrl),
  supabaseUrl: requireString("supabaseUrl", extras.supabaseUrl),
  supabaseAnonKey: requireString("supabaseAnonKey", extras.supabaseAnonKey),
  posthogHost: optionalString(extras.posthogHost),
  posthogApiKey: optionalString(extras.posthogApiKey),
};
