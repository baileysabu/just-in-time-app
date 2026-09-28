// Scheduled job (every 10 min via pg_cron — see LAUNCH_GUIDE.md).
// Re-checks Pro users' flights departing in the next 24h, records changes,
// and sends push notifications (delay, gate change, cancellation, boarding).
//
// Protected by CRON_SECRET: call with header  Authorization: Bearer <CRON_SECRET>
import { fetchFlight } from "../_shared/aerodatabox.ts";
import { detectChanges } from "../_shared/changes.ts";
import { adminClient, env, flightToColumns, json, type TripRow } from "../_shared/util.ts";

const WINDOW_HOURS = 24;
const MIN_INTERVAL_MS = 9 * 60_000;
const MAX_PER_RUN = 100; // keeps each run inside the provider's rate limits

async function sendPush(messages: { to: string; title: string; body: string; data: unknown }[]) {
  // Expo push API accepts up to 100 messages per request
  for (let i = 0; i < messages.length; i += 100) {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages.slice(i, i + 100).map((m) => ({ ...m, sound: "default" }))),
    });
    if (!res.ok) console.error("Expo push failed", res.status, await res.text());
  }
}

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${env("CRON_SECRET")}`) {
    return json({ error: "unauthorized" }, 401);
  }
  const db = adminClient();
  const apiKey = env("AERODATABOX_API_KEY");
  const now = Date.now();

  const { data: proUsers } = await db.from("profiles").select("id").eq("is_pro", true);
  const proIds = ((proUsers ?? []) as { id: string }[]).map((p) => p.id);
  if (proIds.length === 0) return json({ checked: 0 });

  const { data: trips, error } = await db
    .from("trips")
    .select("id, user_id, flight_number, flight_date, origin_iata, status, gate, terminal, estimated_departure, scheduled_departure, last_checked_at")
    .in("user_id", proIds)
    .not("status", "in", "(Departed,Canceled)")
    .gte("estimated_departure", new Date(now - 60 * 60_000).toISOString())
    .lte("estimated_departure", new Date(now + WINDOW_HOURS * 3600_000).toISOString())
    .order("estimated_departure", { ascending: true })
    .limit(MAX_PER_RUN * 2);
  if (error) return json({ error: error.message }, 500);

  const due = (trips as TripRow[]).filter(
    (t) => !t.last_checked_at || now - Date.parse(t.last_checked_at) >= MIN_INTERVAL_MS,
  ).slice(0, MAX_PER_RUN);

  // Same flight tracked by several users → one provider call
  const cache = new Map<string, Awaited<ReturnType<typeof fetchFlight>>>();
  const pushes: { to: string; title: string; body: string; data: unknown }[] = [];
  let changed = 0;

  for (const trip of due) {
    const key = `${trip.flight_number}|${trip.flight_date}|${trip.origin_iata}`;
    try {
      if (!cache.has(key)) {
        cache.set(key, await fetchFlight(apiKey, trip.flight_number, trip.flight_date, trip.origin_iata));
      }
      const info = cache.get(key);
      if (!info) {
        await db.from("trips").update({ last_checked_at: new Date().toISOString() }).eq("id", trip.id);
        continue;
      }
      const changes = detectChanges(trip, info);
      await db.from("trips").update(flightToColumns(info)).eq("id", trip.id);
      if (changes.length === 0) continue;
      changed++;

      await db.from("trip_alerts").insert(
        changes.map((c) => ({ user_id: trip.user_id, trip_id: trip.id, kind: c.kind, message: c.message })),
      );
      const { data: tokens } = await db.from("push_tokens").select("token").eq("user_id", trip.user_id);
      for (const t of tokens ?? []) {
        for (const c of changes) {
          pushes.push({
            to: t.token,
            title: c.kind === "cancel" ? "Flight canceled" : c.kind === "gate" ? "Gate update" : "Flight update",
            body: c.message,
            data: { tripId: trip.id },
          });
        }
      }
    } catch (e) {
      console.error(`refresh ${trip.flight_number} failed`, e);
    }
  }

  if (pushes.length > 0) await sendPush(pushes);
  return json({ checked: due.length, changed, pushed: pushes.length });
});
