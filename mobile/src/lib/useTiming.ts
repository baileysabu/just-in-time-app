import { useMemo } from "react";
import { buildSegments, leaveByDate } from "./timing";
import type { Profile, Trip } from "./types";

export function useTiming(trip: Trip | null, profile: Profile | null) {
  return useMemo(() => {
    if (!trip) return null;
    const segments = buildSegments({
      originIata: trip.origin_iata,
      departureISO: trip.estimated_departure,
      originTimeZone: trip.origin_tz,
      terminal: trip.terminal,
      gate: trip.gate,
      driveMinutes: trip.drive_minutes,
      driveIsLive: trip.drive_is_live,
      prefs: { precheck: profile?.precheck ?? false, checkingBag: profile?.checking_bag ?? false },
      overrides: trip.segment_overrides,
    });
    return { segments, leaveBy: leaveByDate(trip.estimated_departure, segments) };
  }, [trip, profile?.precheck, profile?.checking_bag]);
}
