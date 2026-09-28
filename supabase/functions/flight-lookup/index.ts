// POST /functions/v1/flight-lookup
//   { flight: "AA1204", date: "2026-10-03", origin?: "JFK" }  → preview a flight (no DB write)
//   { tripId: "<uuid>" }                                        → refresh a saved trip from the provider
import { fetchFlight } from "../_shared/aerodatabox.ts";
import { detectChanges } from "../_shared/changes.ts";
import { adminClient, corsHeaders, env, flightToColumns, json, userClient } from "../_shared/util.ts";

const MIN_REFRESH_MS = 5 * 60_000; // protects the flight-data quota

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await userClient(req);
    if (!auth) return json({ error: "Not signed in" }, 401);
    const apiKey = env("AERODATABOX_API_KEY");
    const body = await req.json().catch(() => ({}));

    // ── Refresh an existing trip ──────────────────────────────
    if (typeof body.tripId === "string") {
      const { data: trip, error } = await auth.client
        .from("trips")
        .select("*")
        .eq("id", body.tripId)
        .single();
      if (error || !trip) return json({ error: "Trip not found" }, 404);

      const fresh =
        trip.last_checked_at && Date.now() - Date.parse(trip.last_checked_at) < MIN_REFRESH_MS;
      if (fresh) return json({ trip, changes: [] });

      const info = await fetchFlight(apiKey, trip.flight_number, trip.flight_date, trip.origin_iata);
      if (!info) {
        await auth.client.from("trips").update({ last_checked_at: new Date().toISOString() }).eq("id", trip.id);
        return json({ trip, changes: [] });
      }
      const changes = detectChanges(trip, info);
      const { data: updated } = await auth.client
        .from("trips")
        .update(flightToColumns(info))
        .eq("id", trip.id)
        .select("*")
        .single();
      if (changes.length > 0) {
        await adminClient().from("trip_alerts").insert(
          changes.map((c) => ({ user_id: auth.userId, trip_id: trip.id, kind: c.kind, message: c.message })),
        );
      }
      return json({ trip: updated ?? trip, changes });
    }

    // ── Preview a new flight ──────────────────────────────────
    const flight = typeof body.flight === "string" ? body.flight.toUpperCase().replace(/\s/g, "") : "";
    const date = typeof body.date === "string" ? body.date : "";
    if (!/^[A-Z0-9]{2,3}\d{1,4}$/.test(flight) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ error: "Enter a flight number like AA1204 and a date." }, 400);
    }
    const info = await fetchFlight(apiKey, flight, date, body.origin ?? null);
    if (!info) return json({ error: `We couldn't find ${flight} on ${date}. Check the number and date.` }, 404);
    return json({ flight: info });
  } catch (e) {
    console.error(e);
    return json({ error: "Flight lookup failed. Please try again." }, 500);
  }
});
