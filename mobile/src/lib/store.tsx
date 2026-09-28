import type { Session } from "@supabase/supabase-js";
import * as Location from "expo-location";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import * as api from "./api";
import { registerForPush, scheduleLeaveReminders } from "./notifications";
import { hasProEntitlement, initPurchases, logOutPurchases } from "./purchases";
import { supabase } from "./supabase";
import { isUpcoming, type Profile, type Trip, type TripAlert } from "./types";

type Store = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  isPro: boolean;
  trips: Trip[];
  upcoming: Trip[];
  past: Trip[];
  alerts: TripAlert[];
  activeTrip: Trip | null;
  selectTrip: (id: string) => void;
  reload: () => Promise<void>;
  refreshActive: (opts?: { force?: boolean }) => Promise<string[]>;
  patchTrip: (id: string, patch: Partial<Trip>) => void;
  setProfile: (patch: Partial<Profile>) => void;
  setProActive: (active: boolean) => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

const DRIVE_REFRESH_MS = 10 * 60_000;
const FLIGHT_REFRESH_MS = 5 * 60_000;

export function AppProvider({ children }: { children: ReactNode }) {
  const [authChecked, setAuthChecked] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [alerts, setAlerts] = useState<TripAlert[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entitled, setEntitled] = useState(false);
  const [now, setNow] = useState(Date.now());
  const refreshing = useRef(false);

  // ── Auth ─────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setProfileState(null);
        setTrips([]);
        setAlerts([]);
        setEntitled(false);
        setLoadedFor(null);
      }
      setAuthChecked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  // Ready once we know the auth state and, if signed in, that user's data has loaded
  const ready = authChecked && (!userId || loadedFor === userId);

  const reload = useCallback(async () => {
    if (!userId) return;
    const [p, t, a] = await Promise.all([
      api.fetchProfile(),
      api.fetchTrips().catch(() => null),
      api.fetchAlerts().catch(() => null),
    ]);
    if (p) setProfileState(p);
    if (t) setTrips(t);
    if (a) setAlerts(a);
  }, [userId]);

  // Load data + set up purchases/push once signed in
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } finally {
        if (!cancelled) setLoadedFor(userId);
      }
      try {
        await initPurchases(userId);
        const pro = await hasProEntitlement();
        if (!cancelled) setEntitled(pro);
      } catch (e) {
        console.warn("purchases init failed", e);
      }
      registerForPush();
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, reload]);

  // Re-evaluate "upcoming" every minute and reload when the app comes back
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        setNow(Date.now());
        reload();
      }
    });
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [reload]);

  const upcoming = useMemo(() => trips.filter((t) => isUpcoming(t, now)), [trips, now]);
  const past = useMemo(
    () => trips.filter((t) => !isUpcoming(t, now)).reverse(),
    [trips, now],
  );
  const activeTrip = upcoming.find((t) => t.id === selectedId) ?? upcoming[0] ?? null;
  const isPro = entitled || !!profile?.is_pro;

  // Keep local leave-by reminders in sync with the data
  useEffect(() => {
    if (!ready || !userId) return;
    scheduleLeaveReminders(upcoming, profile).catch((e) => console.warn(e));
  }, [ready, userId, upcoming, profile]);

  const patchTrip = useCallback((id: string, patch: Partial<Trip>) => {
    setTrips((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  /**
   * Refreshes the active trip's flight status (gate/delay) and live drive time.
   * Returns human-readable change messages to show in the UI.
   */
  const refreshActive = useCallback(
    async (opts?: { force?: boolean }) => {
      const trip = activeTrip;
      if (!trip || refreshing.current) return [];
      refreshing.current = true;
      const messages: string[] = [];
      try {
        const departsIn = Date.parse(trip.estimated_departure) - Date.now();
        const flightStale =
          !trip.last_checked_at || Date.now() - Date.parse(trip.last_checked_at) > FLIGHT_REFRESH_MS;
        if ((opts?.force || flightStale) && departsIn < 3 * 24 * 3600_000) {
          try {
            const res = await api.refreshTrip(trip.id);
            if (res.trip) patchTrip(trip.id, res.trip);
            messages.push(...res.changes.map((c) => c.message));
          } catch (e) {
            console.warn(e);
          }
        }

        const driveStale =
          !trip.drive_updated_at || Date.now() - Date.parse(trip.drive_updated_at) > DRIVE_REFRESH_MS;
        if ((opts?.force || driveStale) && departsIn < 48 * 3600_000 && trip.origin_lat != null) {
          const perm = await Location.getForegroundPermissionsAsync();
          if (perm.granted) {
            const pos =
              (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 })) ??
              (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
            const res = await api.updateDriveTime(trip.id, pos.coords.latitude, pos.coords.longitude);
            patchTrip(trip.id, {
              drive_minutes: res.minutes,
              drive_is_live: res.live,
              drive_updated_at: new Date().toISOString(),
            });
          }
        }
        if (messages.length) api.fetchAlerts().then(setAlerts).catch(() => {});
      } catch (e) {
        console.warn("refresh failed", e);
      } finally {
        refreshing.current = false;
      }
      return messages;
    },
    [activeTrip, patchTrip],
  );

  const value: Store = {
    ready,
    session,
    profile,
    isPro,
    trips,
    upcoming,
    past,
    alerts,
    activeTrip,
    selectTrip: setSelectedId,
    reload,
    refreshActive,
    patchTrip,
    setProfile: (patch) => setProfileState((p) => (p ? { ...p, ...patch } : p)),
    setProActive: setEntitled,
    signOut: async () => {
      await logOutPurchases();
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
