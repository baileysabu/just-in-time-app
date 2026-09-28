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
