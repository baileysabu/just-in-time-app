// POST /functions/v1/delete-account
// Permanently deletes the signed-in user and all their data (Apple requires
// in-app account deletion). Trips, alerts, push tokens and profile cascade.
import { adminClient, corsHeaders, json, userClient } from "../_shared/util.ts";

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
