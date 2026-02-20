import Constants from "expo-constants";

export type AppEnv = {
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

function requireString(name: string, value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required Expo extra value: ${name}`);
  }
  return value;
}

const extras = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

export const env: AppEnv = {
  apiBaseUrl: requireString("apiBaseUrl", extras.apiBaseUrl),
  supabaseUrl: requireString("supabaseUrl", extras.supabaseUrl),
  supabaseAnonKey: requireString("supabaseAnonKey", extras.supabaseAnonKey)
};
