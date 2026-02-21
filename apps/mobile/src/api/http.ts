import { env } from "../config/env";
import { useSessionStore } from "../state/session";

type HttpMethod = "GET" | "POST" | "PATCH";

type RequestOptions = {
  method: HttpMethod;
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
};

export async function apiRequest<T>(options: RequestOptions): Promise<T> {
  const query = options.query
    ? `?${new URLSearchParams(
        Object.entries(options.query)
          .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
          .map(([key, value]) => [key, String(value)])
      ).toString()}`
    : "";

  const requestOnce = async (token: string | null) => {
    const response = await fetch(`${env.apiBaseUrl}${options.path}${query}`, {
      method: options.method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    return {
      response,
      message: response.ok ? null : await response.text()
    };
  };

  let token = useSessionStore.getState().accessToken;
  let attempt = await requestOnce(token);

  const shouldRetryWithRefresh =
    attempt.response.status === 401 &&
    typeof attempt.message === "string" &&
    /invalid jwt/i.test(attempt.message);

  if (shouldRetryWithRefresh) {
    const sessionStore = useSessionStore.getState();
    let refreshedToken = await sessionStore.refreshAccessToken();

    if (!refreshedToken) {
      await sessionStore.bootstrapSession();
      refreshedToken = useSessionStore.getState().accessToken;
    }

    if (refreshedToken) {
      token = refreshedToken;
      attempt = await requestOnce(token);
    }
  }

  if (!attempt.response.ok) {
    throw new Error(
      `API ${options.path} failed (${attempt.response.status}): ${attempt.message ?? "Unknown error"}`
    );
  }

  return (await attempt.response.json()) as T;
}
