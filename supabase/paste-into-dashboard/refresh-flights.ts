// ===== refresh-flights — paste this whole file into the Supabase dashboard editor =====
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ---- flight data ----
/**
 * AeroDataBox (via RapidAPI) flight status client.
 * Docs: https://doc.aerodatabox.com  — endpoint: GET /flights/number/{number}/{dateLocal}
 *
 * The parser is written defensively because AeroDataBox has shipped two time
 * formats: `scheduledTime: { utc, local }` (current) and `scheduledTimeUtc` (legacy).
 */

export type FlightInfo = {
  flight: string;
  airline: string;
  status: string; // Expected | Delayed | Boarding | Departed | Canceled | ...
  originIata: string;
  originName: string;
  originLat: number | null;
  originLon: number | null;
  originTimeZone: string | null;
  destinationIata: string;
  destinationName: string;
  scheduledDeparture: string; // ISO UTC
  estimatedDeparture: string; // ISO UTC (revised/predicted, or scheduled)
  scheduledArrival: string | null;
  terminal: string | null;
  gate: string | null;
  durationMinutes: number | null;
};

// deno-lint-ignore no-explicit-any
type Any = any;

/** "2026-09-29 14:25Z" / "2026-09-29T14:25:00Z" → ISO string, or null. */
export function toIso(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function pickUtc(point: Any, key: "scheduled" | "revised" | "predicted" | "runway"): string | null {
  if (!point) return null;
  const modern = point[`${key}Time`];
  if (modern && typeof modern === "object") return toIso(modern.utc);
  return toIso(point[`${key}TimeUtc`]);
}

export function parseFlight(raw: Any, requestedFlight: string): FlightInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const dep = raw.departure ?? {};
  const arr = raw.arrival ?? {};
  const scheduledDeparture = pickUtc(dep, "scheduled");
  if (!scheduledDeparture) return null;
  const estimatedDeparture =
    pickUtc(dep, "revised") ?? pickUtc(dep, "predicted") ?? scheduledDeparture;
  const scheduledArrival = pickUtc(arr, "scheduled");
  const duration =
    scheduledArrival != null
      ? Math.round((Date.parse(scheduledArrival) - Date.parse(scheduledDeparture)) / 60000)
      : null;
  const loc = dep.airport?.location ?? {};
  return {
    flight: requestedFlight,
    airline: raw.airline?.name ?? "",
    status: normalizeStatus(raw.status, scheduledDeparture, estimatedDeparture),
    originIata: dep.airport?.iata ?? "",
    originName: dep.airport?.shortName ?? dep.airport?.municipalityName ?? dep.airport?.name ?? "",
    originLat: typeof loc.lat === "number" ? loc.lat : null,
    originLon: typeof loc.lon === "number" ? loc.lon : null,
    originTimeZone: dep.airport?.timeZone ?? null,
    destinationIata: arr.airport?.iata ?? "",
    destinationName:
      arr.airport?.shortName ?? arr.airport?.municipalityName ?? arr.airport?.name ?? "",
    scheduledDeparture,
    estimatedDeparture,
    scheduledArrival,
    terminal: dep.terminal ? String(dep.terminal) : null,
    gate: dep.gate ? String(dep.gate) : null,
    durationMinutes: duration != null && duration > 0 ? duration : null,
  };
}

export function normalizeStatus(status: unknown, scheduled: string, estimated: string): string {
  const s = typeof status === "string" ? status : "Unknown";
  const delayMin = Math.round((Date.parse(estimated) - Date.parse(scheduled)) / 60000);
  if (/cancel/i.test(s)) return "Canceled";
  if (/divert/i.test(s)) return "Diverted";
  if (/depart|enroute|en route|airborne|arrived|landed/i.test(s)) return "Departed";
  if (/board/i.test(s)) return "Boarding";
  if (/gateclosed|gate closed/i.test(s)) return "Gate closed";
  if (delayMin >= 15 || /delay/i.test(s)) return "Delayed";
  return "On time";
}

/**
 * Picks the leg departing from `originHint` when a flight number has several
 * legs on one day (e.g. WN flights with stops); otherwise the first leg.
 */
export function chooseLeg(flights: FlightInfo[], originHint?: string | null): FlightInfo | null {
  if (flights.length === 0) return null;
  if (originHint) {
    const match = flights.find((f) => f.originIata === originHint.toUpperCase());
    if (match) return match;
  }
  return [...flights].sort((a, b) => a.scheduledDeparture.localeCompare(b.scheduledDeparture))[0];
}

export async function fetchFlight(
  apiKey: string,
  flight: string,
  dateLocal: string,
  originHint?: string | null,
): Promise<FlightInfo | null> {
  const url =
    `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(flight)}/${dateLocal}` +
    `?withAircraftImage=false&withLocation=false`;
  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
    },
  });
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) throw new Error(`Flight data provider error ${res.status}`);
  const body = await res.json();
  const list: Any[] = Array.isArray(body) ? body : [body];
  const parsed = list
    .map((f) => parseFlight(f, flight))
    .filter((f): f is FlightInfo => f !== null);
  return chooseLeg(parsed, originHint);
}

// ---- change detection ----

export type Change = { kind: "delay" | "gate" | "cancel" | "status"; message: string };

type Before = {
  flight_number: string;
  status: string;
  gate: string | null;
  estimated_departure: string;
};

function clock(iso: string, tz: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz ?? "UTC",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(11, 16) + " UTC";
  }
}

/** Compares stored trip vs fresh provider data and describes what changed. */
export function detectChanges(before: Before, after: FlightInfo): Change[] {
  const changes: Change[] = [];
  const name = before.flight_number.replace(/^([A-Z0-9]{2})(\d+)$/, "$1 $2");

  if (after.status === "Canceled" && before.status !== "Canceled") {
    changes.push({ kind: "cancel", message: `${name} has been canceled. Check your airline app to rebook.` });
    return changes;
  }

  const shift = Math.round(
    (Date.parse(after.estimatedDeparture) - Date.parse(before.estimated_departure)) / 60000,
  );
  if (Math.abs(shift) >= 10) {
    const when = clock(after.estimatedDeparture, after.originTimeZone);
    changes.push({
      kind: "delay",
      message:
        shift > 0
          ? `${name} delayed ${shift} min — now departs ${when}. Your leave-by time moved later.`
          : `${name} now departs ${Math.abs(shift)} min earlier (${when}). Leave sooner!`,
    });
  }

  if (after.gate && before.gate && after.gate !== before.gate) {
    changes.push({ kind: "gate", message: `Gate change for ${name}: ${before.gate} → ${after.gate}` });
  } else if (after.gate && !before.gate) {
    changes.push({ kind: "gate", message: `Gate assigned for ${name}: ${after.gate}` });
  }

  if (after.status === "Boarding" && before.status !== "Boarding") {
    changes.push({ kind: "status", message: `${name} is now boarding${after.gate ? ` at gate ${after.gate}` : ""}.` });
  }
  return changes;
}

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

export type TripRow = {
  id: string;
  user_id: string;
  flight_number: string;
  flight_date: string;
  origin_iata: string;
  status: string;
  gate: string | null;
  terminal: string | null;
  estimated_departure: string;
  scheduled_departure: string;
  last_checked_at: string | null;
};

/** Converts provider data into trip columns. */
export function flightToColumns(f: FlightInfo) {
  return {
    airline: f.airline,
    status: f.status,
    origin_iata: f.originIata,
    origin_name: f.originName,
    origin_lat: f.originLat,
    origin_lon: f.originLon,
    origin_tz: f.originTimeZone,
    destination_iata: f.destinationIata,
    destination_name: f.destinationName,
    scheduled_departure: f.scheduledDeparture,
    estimated_departure: f.estimatedDeparture,
    scheduled_arrival: f.scheduledArrival,
    duration_minutes: f.durationMinutes,
    terminal: f.terminal,
    gate: f.gate,
    last_checked_at: new Date().toISOString(),
  };
}

// ---- function ----
// Scheduled job (every 10 min via pg_cron — see LAUNCH_GUIDE.md).
// Re-checks Pro users' flights departing in the next 24h, records changes,
// and sends push notifications (delay, gate change, cancellation, boarding).
//
// Protected by CRON_SECRET: call with header  Authorization: Bearer <CRON_SECRET>

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
