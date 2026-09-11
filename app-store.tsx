import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Segment = {
  id: string;
  label: string;
  detail: string;
  minutes: number;
};

export type Milestone = {
  id: string;
  label: string;
  stampedAt: string | null;
};

export type Trip = {
  id: string;
  airline: string;
  flight: string;
  origin: string;
  destination: string;
  departureISO: string;
  durationMinutes: number;
  terminal: string;
  gate: string;
  boardingGroup: string;
  milestones: Milestone[];
};

export type NewTrip = Pick<Trip, "airline" | "flight" | "origin" | "destination" | "departureISO">;
export type CalendarProvider = "google" | "apple";

export type TripRecord = {
  id: string;
  route: string;
  flight: string;
  date: string;
  checkInMinutes: number;
  walkMinutes: number;
};

export type User = {
  email: string;
  phone: string;
};

export type Plan = "monthly" | "annual";

export type Scenario = "ontime" | "delayed" | "gate";

type State = {
  user: User | null;
  onboarded: boolean;
  pro: boolean;
  plan: Plan | null;
  segments: Segment[];
  trips: Trip[];
  activeTripId: string;
  history: TripRecord[];
  scenario: Scenario;
  calendarSync: Record<CalendarProvider, { connected: boolean; imported: number }>;
};

const DEFAULT_SEGMENTS: Segment[] = [
  { id: "drive", label: "Drive to Airport", detail: "Home → JFK Terminal 8", minutes: 42 },
  { id: "tsa", label: "TSA Security", detail: "PreCheck lane · live queue", minutes: 18 },
  { id: "walk", label: "Gate Walk Time", detail: "Checkpoint → Gate 14B", minutes: 11 },
  { id: "boarding", label: "Boarding", detail: "Group 3 · doors close T-15", minutes: 25 },
];

const DEFAULT_MILESTONES: Milestone[] = [
  { id: "left", label: "Left Home", stampedAt: null },
  { id: "arrived", label: "Arrived at Airport", stampedAt: null },
  { id: "security", label: "Security Passed", stampedAt: null },
  { id: "gate", label: "At Gate", stampedAt: null },
];

function milestones() {
  return DEFAULT_MILESTONES.map((milestone) => ({ ...milestone }));
}

function futureDeparture(days: number, hour: number, minute: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function defaultTrips(): Trip[] {
  return [
    {
      id: "aa1204",
      airline: "American Airlines",
      flight: "AA 1204",
      origin: "JFK",
      destination: "LAX",
      departureISO: futureDeparture(1, 15, 25),
      durationMinutes: 375,
      terminal: "8",
      gate: "B12",
      boardingGroup: "3",
      milestones: milestones(),
    },
    {
      id: "dl482",
      airline: "Delta Air Lines",
      flight: "DL 482",
      origin: "LAX",
      destination: "SEA",
      departureISO: futureDeparture(3, 9, 40),
      durationMinutes: 170,
      terminal: "3",
      gate: "24A",
      boardingGroup: "Main 2",
      milestones: milestones(),
    },
    {
      id: "ua219",
      airline: "United Airlines",
      flight: "UA 219",
      origin: "SFO",
      destination: "ORD",
      departureISO: futureDeparture(6, 13, 10),
      durationMinutes: 255,
      terminal: "3",
      gate: "F16",
      boardingGroup: "2",
      milestones: milestones(),
    },
  ];
}

const DEFAULT_HISTORY: TripRecord[] = [
  {
    id: "t1",
    route: "BOS → SFO",
    flight: "AA 288",
    date: "Aug 21, 2026",
    checkInMinutes: 9,
    walkMinutes: 13,
  },
  {
    id: "t2",
    route: "JFK → MIA",
    flight: "AA 1173",
    date: "Jul 04, 2026",
    checkInMinutes: 14,
    walkMinutes: 8,
  },
  {
    id: "t3",
    route: "LAX → SEA",
    flight: "AA 442",
    date: "Jun 12, 2026",
    checkInMinutes: 11,
    walkMinutes: 10,
  },
];

const KEY = "jit-state-v1";

function initialState(): State {
  const trips = defaultTrips();
  return {
    user: null,
    onboarded: false,
    pro: false,
    plan: null,
    segments: DEFAULT_SEGMENTS,
    trips,
    activeTripId: trips[0]?.id ?? "",
    history: DEFAULT_HISTORY,
    scenario: "ontime",
    calendarSync: {
      google: { connected: false, imported: 0 },
      apple: { connected: false, imported: 0 },
    },
  };
}

type Store = State & {
  hydrated: boolean;
  totalMinutes: number;
  /** Extra minutes the current scenario adds to the door-to-gate walk. */
  extraWalkMinutes: number;
  delayMinutes: number;
  gate: string;
  flightStatus: string;
  effectiveDepartureISO: string;
  activeTrip: Trip;
  milestones: Milestone[];
  departureISO: string;
  setScenario: (scenario: Scenario) => void;
  selectTrip: (id: string) => void;
  addTrip: (trip: NewTrip) => void;
  toggleCalendar: (provider: CalendarProvider) => void;
  login: (email: string) => void;
  signup: (email: string, phone: string) => void;
  logout: () => void;
  completeOnboarding: () => void;
  replayOnboarding: () => void;
  setSegmentMinutes: (id: string, minutes: number) => void;
  stamp: (id: string) => void;
  resetJourney: () => void;
  subscribe: (plan: Plan) => void;
  restore: () => boolean;
  cancelPro: () => void;
};

const Ctx = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const defaults = initialState();
        const saved = JSON.parse(raw) as Partial<State> & { milestones?: Milestone[]; departureISO?: string };
        const savedTrips = Array.isArray(saved.trips) && saved.trips.length > 0 ? saved.trips : defaults.trips;
        setState({
          ...defaults,
          ...saved,
          trips: savedTrips.map((trip) => ({
            ...trip,
            milestones:
              Array.isArray(trip.milestones) && trip.milestones.some((item) => item.id === "left")
                ? trip.milestones
                : milestones(),
          })),
          activeTripId: savedTrips.some((trip) => trip.id === saved.activeTripId)
            ? (saved.activeTripId ?? savedTrips[0]?.id ?? "")
            : (savedTrips[0]?.id ?? ""),
          calendarSync: {
            google: { ...defaults.calendarSync.google, ...saved.calendarSync?.google },
            apple: { ...defaults.calendarSync.apple, ...saved.calendarSync?.apple },
          },
        });
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated]);

  const value = useMemo<Store>(() => {
    const activeTrip = state.trips.find((trip) => trip.id === state.activeTripId) ?? state.trips[0];
    if (!activeTrip) throw new Error("At least one trip is required");
    const scenario = state.scenario;
    const extraWalkMinutes = scenario === "gate" ? 7 : 0;
    const delayMinutes = scenario === "delayed" ? 25 : 0;
    const totalMinutes =
      state.segments.reduce((sum, s) => sum + s.minutes, 0) + extraWalkMinutes;
    const effectiveDepartureISO = new Date(
      new Date(activeTrip.departureISO).getTime() + delayMinutes * 60000,
    ).toISOString();
    return {
      ...state,
      hydrated,
      totalMinutes,
      extraWalkMinutes,
      delayMinutes,
      gate: scenario === "gate" ? "C4" : activeTrip.gate,
      flightStatus:
        scenario === "delayed" ? "Delayed +25m" : scenario === "gate" ? "Gate change" : "On time",
      effectiveDepartureISO,
      activeTrip,
      milestones: activeTrip.milestones,
      departureISO: activeTrip.departureISO,
      setScenario: (next) => setState((s) => ({ ...s, scenario: next })),
      selectTrip: (id) => setState((s) => ({ ...s, activeTripId: id, scenario: "ontime" })),
      addTrip: (trip) =>
        setState((s) => {
          const id = `${trip.flight.replace(/\s/g, "").toLowerCase()}-${Date.now()}`;
          const created: Trip = {
            ...trip,
            id,
            durationMinutes: 180,
            terminal: "—",
            gate: "TBD",
            boardingGroup: "TBD",
            milestones: milestones(),
          };
          return { ...s, trips: [...s.trips, created], activeTripId: id, scenario: "ontime" };
        }),
      toggleCalendar: (provider) =>
        setState((s) => {
          const connected = !s.calendarSync[provider].connected;
          return {
            ...s,
            calendarSync: {
              ...s.calendarSync,
              [provider]: { connected, imported: connected ? (provider === "google" ? 2 : 1) : 0 },
            },
          };
        }),
      login: (email) =>
        setState((s) => ({ ...s, user: { email, phone: s.user?.phone ?? "+1 (555) 019-4471" } })),
      signup: (email, phone) => setState((s) => ({ ...s, user: { email, phone } })),
      logout: () => setState((s) => ({ ...s, user: null })),
      completeOnboarding: () => setState((s) => ({ ...s, onboarded: true })),
      replayOnboarding: () => setState((s) => ({ ...s, onboarded: false })),
      setSegmentMinutes: (id, minutes) =>
        setState((s) => ({
          ...s,
          segments: s.segments.map((seg) =>
            seg.id === id ? { ...seg, minutes: Math.max(0, Math.min(240, minutes)) } : seg,
          ),
        })),
      stamp: (id) =>
        setState((s) => ({
          ...s,
          trips: s.trips.map((trip) =>
            trip.id === s.activeTripId
              ? {
                  ...trip,
                  milestones: trip.milestones.map((milestone) =>
                    milestone.id === id
                      ? { ...milestone, stampedAt: milestone.stampedAt ?? new Date().toISOString() }
                      : milestone,
                  ),
                }
              : trip,
          ),
        })),
      resetJourney: () =>
        setState((s) => ({
          ...s,
          trips: s.trips.map((trip) =>
            trip.id === s.activeTripId ? { ...trip, milestones: milestones() } : trip,
          ),
        })),
      subscribe: (plan) => setState((s) => ({ ...s, pro: true, plan })),
      restore: () => {
        setState((s) => ({ ...s, pro: true, plan: s.plan ?? "annual" }));
        return true;
      },
      cancelPro: () => setState((s) => ({ ...s, pro: false, plan: null })),
    };
  }, [state, hydrated]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppStore must be used inside AppStoreProvider");
  return ctx;
}

export function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}`;
}
