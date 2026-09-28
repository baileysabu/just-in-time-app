// ===== drive-time — paste this whole file into the Supabase dashboard editor =====
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
// POST /functions/v1/drive-time
//   { tripId: "<uuid>", lat: number, lon: number }
// Computes live-traffic drive time from the user's location to the departure
// airport (Google Routes API) and stores it on the trip.
// Falls back to a distance-based estimate if GOOGLE_MAPS_API_KEY isn't set.

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371;
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(bLat - aLat) / 2) ** 2 +
    Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLon - aLon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function googleDriveMinutes(key: string, from: [number, number], to: [number, number]) {
  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: from[0], longitude: from[1] } } },
      destination: { location: { latLng: { latitude: to[0], longitude: to[1] } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
    }),
  });
  if (!res.ok) throw new Error(`Routes API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const duration: string | undefined = data.routes?.[0]?.duration; // e.g. "2520s"
  if (!duration) return null;
  return Math.max(1, Math.round(parseInt(duration, 10) / 60));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await userClient(req);
    if (!auth) return json({ error: "Not signed in" }, 401);
    const { tripId, lat, lon } = await req.json();
    if (typeof tripId !== "string" || typeof lat !== "number" || typeof lon !== "number") {
      return json({ error: "tripId, lat and lon are required" }, 400);
    }
    const { data: trip } = await auth.client
      .from("trips")
      .select("id, origin_lat, origin_lon")
      .eq("id", tripId)
      .single();
    if (!trip || trip.origin_lat == null || trip.origin_lon == null) {
      return json({ error: "Airport location unknown for this trip" }, 404);
    }

    let minutes: number | null = null;
    let live = false;
    const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (key) {
      try {
        minutes = await googleDriveMinutes(key, [lat, lon], [trip.origin_lat, trip.origin_lon]);
        live = minutes != null;
      } catch (e) {
        console.error(e);
      }
    }
    if (minutes == null) {
      const km = haversineKm(lat, lon, trip.origin_lat, trip.origin_lon);
      minutes = Math.max(5, Math.round(((km * 1.3) / 45) * 60));
    }

    await auth.client
      .from("trips")
      .update({ drive_minutes: minutes, drive_is_live: live, drive_updated_at: new Date().toISOString() })
      .eq("id", tripId);
    return json({ minutes, live });
  } catch (e) {
    console.error(e);
    return json({ error: "Couldn't calculate drive time" }, 500);
  }
});
