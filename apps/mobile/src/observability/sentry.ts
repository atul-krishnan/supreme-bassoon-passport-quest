import * as Sentry from "@sentry/react-native";
import { env } from "../config/env";

let hasInitialized = false;

export function initSentry() {
  if (hasInitialized) {
    return;
  }

  // Keep local developer experience clean; non-local envs should report errors.
  if (env.appEnv === "local" || !env.sentryDsn) {
    return;
  }

  Sentry.init({
    dsn: env.sentryDsn,
    enabled: true,
    environment: env.appEnv,
    release: env.releaseSha
      ? `passport-quest-mobile@${env.releaseSha}`
      : undefined,
    tracesSampleRate: env.appEnv === "production" ? 0.1 : 1.0,
  });

  Sentry.setTag("app_env", env.appEnv);
  if (env.releaseSha) {
    Sentry.setTag("release_sha", env.releaseSha);
  }

  hasInitialized = true;
}

export function setSentryUser(userId: string | null) {
  if (!hasInitialized) {
    return;
  }
  Sentry.setUser(userId ? { id: userId } : null);
}

export function captureNonFatal(error: unknown, context?: Record<string, unknown>) {
  if (!hasInitialized) {
    return;
  }

  if (!context) {
    Sentry.captureException(error);
    return;
  }

  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) {
      scope.setExtra(key, value);
    }
    Sentry.captureException(error);
  });
}
