import { supabase } from "./supabase";
import type { SegmentOverrides } from "./timing";
import type { FlightInfo, MilestoneId, Profile, Trip, TripAlert } from "./types";

/** Error with a message that is safe to show to the user. */
export class UserError extends Error {}

async function invoke<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // FunctionsHttpError carries the response; our functions return { error: "..." }
    let message = "Something went wrong. Please try again.";
    try {
      const ctx = (error as { context?: Response }).context;
      const payload = ctx ? await ctx.json() : null;
      if (payload?.error) message = payload.error;
    } catch {
      /* keep default */
    }
    throw new UserError(message);
  }
  return data as T;
}

// ── Flights ──────────────────────────────────────────────────
export async function lookupFlight(flight: string, date: string): Promise<FlightInfo> {
  const res = await invoke<{ flight: FlightInfo }>("flight-lookup", { flight, date });
  return res.flight;
}

export async function refreshTrip(tripId: string) {
  return invoke<{ trip: Trip; changes: { kind: string; message: string }[] }>("flight-lookup", {
    tripId,
  });
}

export async function updateDriveTime(tripId: string, lat: number, lon: number) {
  return invoke<{ minutes: number; live: boolean }>("drive-time", { tripId, lat, lon });
}

// ── Trips ────────────────────────────────────────────────────
export async function fetchTrips(): Promise<Trip[]> {
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .order("estimated_departure", { ascending: true });
  if (error) throw new UserError("Couldn't load your trips.");
  return (data ?? []) as Trip[];
}

export async function addTrip(userId: string, info: FlightInfo, flightDate: string): Promise<Trip> {
  const { data, error } = await supabase
    .from("trips")
    .insert({
      user_id: userId,
      flight_number: info.flight,
      flight_date: flightDate,
      airline: info.airline,
      status: info.status,
      origin_iata: info.originIata,
      origin_name: info.originName,
      origin_lat: info.originLat,
      origin_lon: info.originLon,
      origin_tz: info.originTimeZone,
      destination_iata: info.destinationIata,
      destination_name: info.destinationName,
      scheduled_departure: info.scheduledDeparture,
      estimated_departure: info.estimatedDeparture,
      scheduled_arrival: info.scheduledArrival,
      duration_minutes: info.durationMinutes,
      terminal: info.terminal,
      gate: info.gate,
      last_checked_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) {
    if (error.message.includes("FREE_TRIP_LIMIT")) {
      throw new UserError("FREE_TRIP_LIMIT");
    }
    if (error.code === "23505") throw new UserError("You're already tracking this flight.");
    throw new UserError("Couldn't save this trip. Please try again.");
  }
  return data as Trip;
}

export async function deleteTrip(tripId: string) {
  const { error } = await supabase.from("trips").delete().eq("id", tripId);
  if (error) throw new UserError("Couldn't delete this trip.");
}

export async function updateTrip(
  tripId: string,
  patch: Partial<{
    milestones: Partial<Record<MilestoneId, string>>;
    segment_overrides: SegmentOverrides;
    boarding_group: string | null;
  }>,
) {
  const { error } = await supabase.from("trips").update(patch).eq("id", tripId);
  if (error) throw new UserError("Couldn't save your change.");
}

// ── Profile & alerts ─────────────────────────────────────────
export async function fetchProfile(): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").maybeSingle();
  return (data as Profile) ?? null;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, "precheck" | "checking_bag" | "onboarded">>,
) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw new UserError("Couldn't save your settings.");
}

export async function fetchAlerts(): Promise<TripAlert[]> {
  const { data } = await supabase
    .from("trip_alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as TripAlert[];
}

export async function registerPushToken(token: string) {
  await supabase.rpc("register_push_token", { p_token: token, p_platform: "ios" });
}

export async function deleteAccount() {
  await invoke<{ ok: boolean }>("delete-account", {});
  await supabase.auth.signOut();
}
