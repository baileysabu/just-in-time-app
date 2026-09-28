/**
 * Flight-number helpers and calendar-event parsing. Pure functions only.
 */

/** Airline IATA codes we recognise when scanning free text (calendar events). */
export const KNOWN_AIRLINES: Record<string, string> = {
  AA: "American Airlines",
  DL: "Delta Air Lines",
  UA: "United Airlines",
  WN: "Southwest Airlines",
  AS: "Alaska Airlines",
  B6: "JetBlue",
  NK: "Spirit Airlines",
  F9: "Frontier Airlines",
  HA: "Hawaiian Airlines",
  G4: "Allegiant Air",
  SY: "Sun Country Airlines",
  MX: "Breeze Airways",
  AC: "Air Canada",
  WS: "WestJet",
  AM: "Aeroméxico",
  BA: "British Airways",
  VS: "Virgin Atlantic",
  LH: "Lufthansa",
  AF: "Air France",
  KL: "KLM",
  EK: "Emirates",
  QR: "Qatar Airways",
  EY: "Etihad Airways",
  TK: "Turkish Airlines",
  PK: "Pakistan International Airlines",
  SQ: "Singapore Airlines",
  CX: "Cathay Pacific",
  NH: "ANA",
  JL: "Japan Airlines",
  QF: "Qantas",
  IB: "Iberia",
  LX: "Swiss",
  AV: "Avianca",
  CM: "Copa Airlines",
  LA: "LATAM",
};

/**
 * Normalise user input like "aa 1204", "AA-1204", "aa1204 " → "AA1204".
 * Returns null when it doesn't look like a flight number.
 */
export function normalizeFlightNumber(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[\s\-.]/g, "");
  const m = cleaned.match(/^([A-Z0-9]{2}[A-Z]?)(\d{1,4})$/);
  if (!m) return null;
  const [, carrier, num] = m;
  // Carrier code must contain at least one letter (e.g. "B6", "F9" ok; "12" not)
  if (!/[A-Z]/.test(carrier)) return null;
  return `${carrier}${String(parseInt(num, 10))}`;
}

/** "AA1204" → "AA 1204" for display. */
export function displayFlightNumber(flight: string): string {
  const m = flight.match(/^([A-Z0-9]{2}[A-Z]?)(\d+)$/);
  return m ? `${m[1]} ${m[2]}` : flight;
}

/** YYYY-MM-DD in the device's local time zone. */
export function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type CalendarEventLike = {
  title?: string | null;
  notes?: string | null;
  location?: string | null;
  startDate: string | Date;
};

export type FlightCandidate = {
  flight: string; // normalised, e.g. "AA1204"
  date: string; // YYYY-MM-DD (local date of the event start)
  airline: string;
  sourceTitle: string;
};

const FLIGHT_IN_TEXT = /\b([A-Z][A-Z0-9]|[0-9][A-Z])\s?-?(\d{1,4})\b/g;

/**
 * Finds flights in calendar events. Only codes of known airlines count, which
 * avoids false positives like "Room 12" or "Q3 2026".
 */
export function findFlightsInEvents(events: CalendarEventLike[]): FlightCandidate[] {
  const seen = new Set<string>();
  const out: FlightCandidate[] = [];
  for (const ev of events) {
    const text = [ev.title, ev.location, ev.notes].filter(Boolean).join(" \n ").toUpperCase();
    const start = typeof ev.startDate === "string" ? new Date(ev.startDate) : ev.startDate;
    if (Number.isNaN(start.getTime())) continue;
    const date = localDateString(start);
    for (const match of text.matchAll(FLIGHT_IN_TEXT)) {
      const carrier = match[1];
      const airline = KNOWN_AIRLINES[carrier];
      if (!airline) continue;
      const flight = normalizeFlightNumber(`${carrier}${match[2]}`);
      if (!flight) continue;
      const key = `${flight}|${date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ flight, date, airline, sourceTitle: ev.title ?? flight });
    }
  }
  return out;
}
