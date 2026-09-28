import type { SegmentOverrides } from "./timing";

export type MilestoneId = "left" | "arrived" | "security" | "gate";

export const MILESTONES: { id: MilestoneId; label: string }[] = [
  { id: "left", label: "Left home" },
  { id: "arrived", label: "Arrived at airport" },
  { id: "security", label: "Security passed" },
  { id: "gate", label: "At gate" },
];

export type Trip = {
  id: string;
  user_id: string;
  flight_number: string;
  flight_date: string;
  airline: string;
  status: string;
  origin_iata: string;
  origin_name: string;
  origin_lat: number | null;
  origin_lon: number | null;
  origin_tz: string | null;
  destination_iata: string;
  destination_name: string;
  scheduled_departure: string;
  estimated_departure: string;
  scheduled_arrival: string | null;
  duration_minutes: number | null;
  terminal: string | null;
  gate: string | null;
  boarding_group: string | null;
  drive_minutes: number | null;
  drive_is_live: boolean;
  drive_updated_at: string | null;
  segment_overrides: SegmentOverrides;
  milestones: Partial<Record<MilestoneId, string>>;
  last_checked_at: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string | null;
  is_pro: boolean;
  pro_expires_at: string | null;
  precheck: boolean;
  checking_bag: boolean;
  onboarded: boolean;
};

export type TripAlert = {
  id: number;
  trip_id: string;
  kind: "delay" | "gate" | "cancel" | "status";
  message: string;
  created_at: string;
};

/** What the flight-lookup function returns for a preview. */
export type FlightInfo = {
  flight: string;
  airline: string;
  status: string;
  originIata: string;
  originName: string;
  originLat: number | null;
  originLon: number | null;
  originTimeZone: string | null;
  destinationIata: string;
  destinationName: string;
  scheduledDeparture: string;
  estimatedDeparture: string;
  scheduledArrival: string | null;
  terminal: string | null;
  gate: string | null;
  durationMinutes: number | null;
};

export function isUpcoming(t: Trip, now = Date.now()): boolean {
  // Keep a trip "active" until 1h after departure, unless it has departed/canceled
  if (t.status === "Departed" || t.status === "Canceled") {
    return Date.parse(t.estimated_departure) > now;
  }
  return Date.parse(t.estimated_departure) + 60 * 60_000 > now;
}
