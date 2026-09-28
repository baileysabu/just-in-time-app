import * as Calendar from "expo-calendar";
import { findFlightsInEvents, type FlightCandidate } from "./flights";

/** Scans the next 90 days of the user's calendars for flight numbers. */
export async function scanCalendarForFlights(): Promise<FlightCandidate[] | "denied"> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== "granted") return "denied";
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  if (calendars.length === 0) return [];
  const start = new Date();
  const end = new Date(start.getTime() + 90 * 24 * 3600_000);
  const events = await Calendar.getEventsAsync(
    calendars.map((c) => c.id),
    start,
    end,
  );
  return findFlightsInEvents(
    events.map((e) => ({
      title: e.title,
      notes: e.notes,
      location: e.location,
      startDate: e.startDate,
    })),
  );
}
