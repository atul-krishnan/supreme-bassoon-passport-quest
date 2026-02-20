import { env } from "../config/env";
import { useSessionStore } from "../state/session";

type HttpMethod = "GET" | "POST";

type RequestOptions = {
  method: HttpMethod;
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
};

export async function apiRequest<T>(options: RequestOptions): Promise<T> {
  const token = useSessionStore.getState().accessToken;
  const query = options.query
    ? `?${new URLSearchParams(
        Object.entries(options.query)
          .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
          .map(([key, value]) => [key, String(value)])
      ).toString()}`
    : "";

  const response = await fetch(`${env.apiBaseUrl}${options.path}${query}`, {
    method: options.method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`API ${options.path} failed (${response.status}): ${message}`);
  }

  return (await response.json()) as T;
}
