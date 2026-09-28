// ===== revenuecat-webhook — paste this whole file into the Supabase dashboard editor =====
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

/** Service-role client: bypasses RLS. Only use server-side. */
export function adminClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

/** Client acting as the calling user (RLS applies). Returns null if not signed in. */
export async function userClient(
  req: Request,
): Promise<{ client: SupabaseClient; userId: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const client = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}



// ---- function ----
// RevenueCat → Supabase: keeps profiles.is_pro in sync with the App Store subscription.
// In RevenueCat: Project → Integrations → Webhooks
//   URL:    https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
//   Auth:   Bearer <REVENUECAT_WEBHOOK_SECRET>
// The app calls Purchases.logIn(<supabase user id>) so app_user_id = our user id.

const GRANT = new Set(["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "NON_RENEWING_PURCHASE", "SUBSCRIPTION_EXTENDED", "TEMPORARY_ENTITLEMENT_GRANT"]);
const REVOKE = new Set(["EXPIRATION"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${env("REVENUECAT_WEBHOOK_SECRET")}`) {
    return json({ error: "unauthorized" }, 401);
  }
  const { event } = await req.json();
  if (!event) return json({ ok: true });

  const ids: string[] = [event.app_user_id, ...(event.aliases ?? []), ...(event.transferred_to ?? [])]
    .filter((id: unknown): id is string => typeof id === "string" && UUID.test(id));
  if (ids.length === 0) return json({ ok: true, skipped: "no app user id" });

  const db = adminClient();
  if (event.type === "TRANSFER") {
    for (const id of event.transferred_from ?? []) {
      if (UUID.test(id)) await db.from("profiles").update({ is_pro: false, pro_expires_at: null }).eq("id", id);
    }
    for (const id of event.transferred_to ?? []) {
      if (UUID.test(id)) await db.from("profiles").update({ is_pro: true }).eq("id", id);
    }
    return json({ ok: true });
  }

  const expires = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;
  if (GRANT.has(event.type)) {
    await db.from("profiles").update({ is_pro: true, pro_expires_at: expires }).in("id", ids);
  } else if (REVOKE.has(event.type)) {
    await db.from("profiles").update({ is_pro: false, pro_expires_at: expires }).in("id", ids);
  }
  // CANCELLATION = auto-renew turned off; access continues until EXPIRATION.
  return json({ ok: true });
});
