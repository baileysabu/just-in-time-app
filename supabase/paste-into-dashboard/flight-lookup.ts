// ===== flight-lookup — paste this whole file into the Supabase dashboard editor =====
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
// POST /functions/v1/flight-lookup
//   { flight: "AA1204", date: "2026-10-03", origin?: "JFK" }  → preview a flight (no DB write)
//   { tripId: "<uuid>" }                                        → refresh a saved trip from the provider

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
