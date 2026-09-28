// ===== delete-account — paste this whole file into the Supabase dashboard editor =====
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ---- helpers ----

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing secret ${name}`);
  return v;
}

/** Newer Supabase projects expose API keys as JSON maps instead of the legacy vars. */
function keyFromMap(mapVar: string): string | undefined {
  try {
    const map = JSON.parse(Deno.env.get(mapVar) ?? "{}") as Record<string, string>;
    return map.default ?? Object.values(map)[0];
  } catch {
    return undefined;
  }
}

function anonKey(): string {
  const k = Deno.env.get("SUPABASE_ANON_KEY") || keyFromMap("SUPABASE_PUBLISHABLE_KEYS");
  if (!k) throw new Error("Missing Supabase publishable/anon key");
  return k;
}

function serviceKey(): string {
  const k = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || keyFromMap("SUPABASE_SECRET_KEYS");
  if (!k) throw new Error("Missing Supabase secret/service-role key");
  return k;
}

/** Service-role client: bypasses RLS. Only use server-side. */
export function adminClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), serviceKey(), {
    auth: { persistSession: false },
  });
}

/** Client acting as the calling user (RLS applies). Returns null if not signed in. */
export async function userClient(
  req: Request,
): Promise<{ client: SupabaseClient; userId: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const client = createClient(env("SUPABASE_URL"), anonKey(), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}



// ---- function ----
// POST /functions/v1/delete-account
// Permanently deletes the signed-in user and all their data (Apple requires
// in-app account deletion). Trips, alerts, push tokens and profile cascade.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await userClient(req);
  if (!auth) return json({ error: "Not signed in" }, 401);
  const { error } = await adminClient().auth.admin.deleteUser(auth.userId);
  if (error) {
    console.error(error);
    return json({ error: "Couldn't delete account. Please contact support." }, 500);
  }
  return json({ ok: true });
});
