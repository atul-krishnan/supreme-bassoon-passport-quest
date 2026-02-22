import type { ExpoConfig } from "expo/config";

type AppEnv = "local" | "staging" | "production";

const PROD_SUPABASE_PROJECT_REF =
  process.env.PRODUCTION_SUPABASE_PROJECT_REF ?? "mddunwxatxalpxcccxaf";
const LOCAL_SUPABASE_ANON_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

function readAppEnv(): AppEnv {
  const raw = (process.env.APP_ENV ?? "local").toLowerCase();
  if (raw === "local" || raw === "staging" || raw === "production") {
    return raw;
  }
  throw new Error("APP_ENV must be one of: local, staging, production");
}

function requireWhenRemote(
  appEnv: AppEnv,
  key: string,
  value: string | undefined,
): string {
  const trimmed = value?.trim();
  if (appEnv === "local") {
    return trimmed ?? "";
  }
  if (!trimmed) {
    throw new Error(`${key} is required when APP_ENV is ${appEnv}`);
  }
  return trimmed;
}

function optional(value: string | undefined): string {
  return value?.trim() ?? "";
}

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  const appEnv = readAppEnv();
  const apiBaseUrl =
    process.env.API_BASE_URL?.trim() ??
    "http://127.0.0.1:54321/functions/v1/v1";
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ?? "http://127.0.0.1:54321";
  const supabasePublishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim() ??
    (appEnv === "local" ? LOCAL_SUPABASE_ANON_FALLBACK : "");

  if (
    appEnv === "staging" &&
    supabaseUrl.includes(`${PROD_SUPABASE_PROJECT_REF}.supabase.co`)
  ) {
    throw new Error(
      "Staging build cannot target production Supabase project URL",
    );
  }

  return {
    ...config,
    name: appEnv === "staging" ? "Passport Quest (Staging)" : "Passport Quest",
    slug: "passport-quest",
    scheme: "passportquest",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    assetBundlePatterns: ["**/*"],
    plugins: ["expo-router", "expo-sqlite"],
    ios: {
      ...config.ios,
      supportsTablet: false,
      bundleIdentifier:
        appEnv === "staging"
          ? "com.passportquest.mobile.staging"
          : "com.passportquest.mobile",
    },
    android: {
      ...config.android,
      package:
        appEnv === "staging"
          ? "com.passportquest.mobile.staging"
          : "com.passportquest.mobile",
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "POST_NOTIFICATIONS",
      ],
    },
    extra: {
      appEnv,
      apiBaseUrl,
      supabaseUrl,
      supabasePublishableKey: requireWhenRemote(
        appEnv,
        "SUPABASE_PUBLISHABLE_KEY",
        supabasePublishableKey,
      ),
      // Legacy key remains for backward compatibility while env.ts migrates.
      supabaseAnonKey: optional(process.env.SUPABASE_ANON_KEY),
      posthogHost: optional(process.env.POSTHOG_HOST),
      posthogApiKey: optional(process.env.POSTHOG_API_KEY),
      sentryDsn: requireWhenRemote(appEnv, "SENTRY_DSN", process.env.SENTRY_DSN),
      releaseSha: optional(process.env.RELEASE_SHA || process.env.GITHUB_SHA),
      productionSupabaseProjectRef: PROD_SUPABASE_PROJECT_REF,
      eas: {
        projectId: process.env.EAS_PROJECT_ID,
      },
    },
  };
};
