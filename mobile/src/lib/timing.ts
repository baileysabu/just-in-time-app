/**
 * Door-to-gate timing model. Pure functions only (no React / Expo imports) so it
 * can be unit tested and reused anywhere.
 */

export type SegmentId = "drive" | "tsa" | "walk" | "boarding";

export type Segment = {
  id: SegmentId;
  label: string;
  minutes: number;
  /** true when the value came from live data (traffic API) instead of an estimate */
  live?: boolean;
};

export type TimingPrefs = {
  precheck: boolean;
  checkingBag: boolean;
};

/** Minutes the user manually added/removed per segment (+/- buttons). */
export type SegmentOverrides = Partial<Record<SegmentId, number>>;

/** Busiest US airports: longer security lines and longer walks. */
const LARGE_HUBS = new Set([
  "ATL", "LAX", "ORD", "DFW", "DEN", "JFK", "SFO", "SEA", "LAS", "MCO", "EWR", "CLT",
  "PHX", "IAH", "MIA", "BOS", "MSP", "FLL", "DTW", "PHL", "LGA", "BWI", "SLC", "SAN",
  "IAD", "DCA", "TPA", "MDW", "HNL", "AUS", "BNA",
]);

const MEDIUM_HUBS = new Set([
  "DAL", "HOU", "PDX", "STL", "RDU", "SMF", "MCI", "SJC", "OAK", "SAT", "CLE", "IND",
  "MSY", "PIT", "CMH", "CVG", "SNA", "RSW", "PBI", "JAX", "OGG", "BUR", "ONT", "ABQ",
  "BDL", "ANC", "OMA", "MKE", "RIC", "BOI", "SDF", "ELP", "TUS", "OKC", "BUF", "ORF",
]);

export function airportSize(iata: string): "large" | "medium" | "small" {
  const code = iata.toUpperCase();
  if (LARGE_HUBS.has(code)) return "large";
  if (MEDIUM_HUBS.has(code)) return "medium";
  return "small";
}

/**
 * Estimated TSA wait. There is no reliable free real-time TSA feed, so this uses
 * airport size + time-of-day peaks. `localHour` is the hour at the airport.
 */
export function estimateTsaMinutes(iata: string, localHour: number, prefs: TimingPrefs): number {
  const base = { large: 25, medium: 18, small: 12 }[airportSize(iata)];
  let peak = 1;
  if (localHour >= 5 && localHour < 9) peak = 1.4; // morning bank
  else if (localHour >= 15 && localHour < 19) peak = 1.2; // afternoon bank
  else if (localHour >= 22 || localHour < 5) peak = 0.7; // red-eye / quiet hours
  let minutes = base * peak;
  if (prefs.precheck) minutes *= 0.4;
  if (prefs.checkingBag) minutes += 15; // bag drop counter
  return Math.max(5, Math.round(minutes));
}

/** Estimated walk from security checkpoint to gate. */
export function estimateWalkMinutes(iata: string): number {
  return { large: 15, medium: 10, small: 7 }[airportSize(iata)];
}

/** Be at the gate this many minutes before departure (boarding usually starts ~30–40 min out). */
export const BOARDING_BUFFER_MINUTES = 30;

/** Fallback drive estimate when no traffic API key is configured. */
export function estimateDriveMinutesFromDistance(km: number): number {
  const roadKm = km * 1.3; // roads aren't straight lines
  const avgKmh = 45;
  return Math.max(5, Math.round((roadKm / avgKmh) * 60));
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Hour of day at a given IANA time zone (falls back to device time). */
export function localHourAt(iso: string, timeZone?: string | null): number {
  const date = new Date(iso);
  if (timeZone) {
    try {
      const hour = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone,
      }).format(date);
      const n = parseInt(hour, 10);
      if (!Number.isNaN(n)) return n % 24;
    } catch {
      /* unsupported zone → fall through */
    }
  }
  return date.getHours();
}

export type BuildSegmentsInput = {
  originIata: string;
  departureISO: string;
  originTimeZone?: string | null;
  terminal?: string | null;
  gate?: string | null;
  driveMinutes: number | null;
  driveIsLive: boolean;
  prefs: TimingPrefs;
  overrides?: SegmentOverrides | null;
};

export function buildSegments(input: BuildSegmentsInput): Segment[] {
  const o = input.overrides ?? {};
  const hour = localHourAt(input.departureISO, input.originTimeZone);
  const drive = input.driveMinutes ?? 40;
  const clamp = (n: number) => Math.max(0, Math.min(300, Math.round(n)));
  return [
    {
      id: "drive",
      label: "Drive to airport",
      minutes: clamp(drive + (o.drive ?? 0)),
      live: input.driveIsLive,
    },
    {
      id: "tsa",
      label: input.prefs.checkingBag ? "Bag drop + security" : "Security (TSA)",
      minutes: clamp(estimateTsaMinutes(input.originIata, hour, input.prefs) + (o.tsa ?? 0)),
    },
    {
      id: "walk",
      label: "Walk to gate",
      minutes: clamp(estimateWalkMinutes(input.originIata) + (o.walk ?? 0)),
    },
    {
      id: "boarding",
      label: "Boarding buffer",
      minutes: clamp(BOARDING_BUFFER_MINUTES + (o.boarding ?? 0)),
    },
  ];
}

export function totalMinutes(segments: Segment[]): number {
  return segments.reduce((sum, s) => sum + s.minutes, 0);
}

/** The instant the user should leave home. */
export function leaveByDate(departureISO: string, segments: Segment[]): Date {
  return new Date(new Date(departureISO).getTime() - totalMinutes(segments) * 60_000);
}

export type LeaveStatus = "ontrack" | "tight" | "late";

export function leaveStatus(msUntilLeave: number): LeaveStatus {
  if (msUntilLeave <= 0) return "late";
  if (msUntilLeave < 20 * 60_000) return "tight";
  return "ontrack";
}

/** 01:02:03 style countdown; shows days when more than 24h away. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
