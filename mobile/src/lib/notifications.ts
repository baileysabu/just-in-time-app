import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { registerPushToken } from "./api";
import { displayFlightNumber } from "./flights";
import { buildSegments, leaveByDate } from "./timing";
import { isUpcoming, type Profile, type Trip } from "./types";

// Show notifications as banners even while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(ask: boolean): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!ask || !current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

/** Registers this device for server push (delay / gate alerts). */
export async function registerForPush(): Promise<void> {
  if (!Device.isDevice) return; // simulators can't receive push
  if (!(await ensureNotificationPermission(false))) return;
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId || projectId.startsWith("REPLACE")) return;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerPushToken(data);
  } catch (e) {
    console.warn("push registration failed", e);
  }
}

const LEAVE_PREFIX = "leave-";

/**
 * Local "time to leave" reminders. These fire on-device, so they work for every
 * user without a server. Re-run whenever trips, drive time or settings change.
 */
export async function scheduleLeaveReminders(trips: Trip[], profile: Profile | null) {
  if (!(await ensureNotificationPermission(false))) return;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    existing
      .filter((n) => n.identifier.startsWith(LEAVE_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const now = Date.now();
  const prefs = { precheck: profile?.precheck ?? false, checkingBag: profile?.checking_bag ?? false };
  for (const trip of trips.filter((t) => isUpcoming(t, now) && t.status !== "Canceled")) {
    const segments = buildSegments({
      originIata: trip.origin_iata,
      departureISO: trip.estimated_departure,
      originTimeZone: trip.origin_tz,
      driveMinutes: trip.drive_minutes,
      driveIsLive: trip.drive_is_live,
      prefs,
      overrides: trip.segment_overrides,
    });
    const leaveBy = leaveByDate(trip.estimated_departure, segments).getTime();
    const name = displayFlightNumber(trip.flight_number);
    const reminders = [
      { at: leaveBy - 30 * 60_000, suffix: "30", title: `Leave in 30 min · ${name}`, body: `Start wrapping up — you should head to ${trip.origin_iata} soon.` },
      { at: leaveBy, suffix: "now", title: `Time to leave · ${name}`, body: `Leave now to reach gate${trip.gate ? ` ${trip.gate}` : ""} on time.` },
    ];
    for (const r of reminders) {
      if (r.at <= now + 5_000) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `${LEAVE_PREFIX}${trip.id}-${r.suffix}`,
        content: { title: r.title, body: r.body, sound: "default", data: { tripId: trip.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.at) },
      });
    }
  }
}
