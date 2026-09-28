// RevenueCat → Supabase: keeps profiles.is_pro in sync with the App Store subscription.
// In RevenueCat: Project → Integrations → Webhooks
//   URL:    https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
//   Auth:   Bearer <REVENUECAT_WEBHOOK_SECRET>
// The app calls Purchases.logIn(<supabase user id>) so app_user_id = our user id.
import { adminClient, env, json } from "../_shared/util.ts";

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
