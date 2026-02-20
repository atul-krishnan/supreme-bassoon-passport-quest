import { corsHeaders } from "./cors.ts";

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}

export function errorResponse(status: number, message: string): Response {
  return jsonResponse({ error: message }, status);
}
