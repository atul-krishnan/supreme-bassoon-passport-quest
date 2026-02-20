import { createClient } from "npm:@supabase/supabase-js@2.49.4";

export type AuthUser = {
  id: string;
};

export function makeAnonAuthClient(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
  }

  const authHeader = req.headers.get("Authorization") ?? "";

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });
}

export async function requireAuthUser(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return null;
  }

  const anonClient = makeAnonAuthClient(req);
  const { data, error } = await anonClient.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return { id: data.user.id };
}
