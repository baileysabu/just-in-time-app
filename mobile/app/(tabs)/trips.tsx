import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, Pressable, View } from "react-native";
import { Milestones, statusTone } from "@/components/trip";
import { Badge, Button, Card, Screen, T } from "@/components/ui";
import { deleteTrip, updateTrip } from "@/lib/api";
import { displayFlightNumber } from "@/lib/flights";
import { formatClock, formatDay } from "@/lib/format";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";
import { formatMinutes } from "@/lib/timing";
import type { MilestoneId, Trip } from "@/lib/types";

function minutesBetween(a?: string, b?: string) {
  if (!a || !b) return null;
  return Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000));
}

function JourneyStats({ trip }: { trip: Trip }) {
  const m = trip.milestones ?? {};
  const rows: [string, number | null][] = [
    ["Drive", minutesBetween(m.left, m.arrived)],
    ["Security", minutesBetween(m.arrived, m.security)],
    ["Walk to gate", minutesBetween(m.security, m.gate)],
    ["Door to gate", minutesBetween(m.left, m.gate)],
  ];
  if (rows.every(([, v]) => v == null)) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {rows.map(([label, v]) => (
        <View
          key={label}
          style={{ backgroundColor: colors.background + "AA", borderRadius: 12, padding: 10, minWidth: "47%", flexGrow: 1 }}
        >
          <T kind="label" style={{ fontSize: 10 }}>{label}</T>
          <T kind="h3" color={v == null ? colors.muted : colors.highlight}>{v == null ? "—" : formatMinutes(v)}</T>
        </View>
      ))}
    </View>
  );
}

export default function Trips() {
  const { upcoming, past, activeTrip, selectTrip, patchTrip, reload } = useApp();

  function stamp(trip: Trip, id: MilestoneId) {
    const milestones = { ...trip.milestones, [id]: new Date().toISOString() };
    patchTrip(trip.id, { milestones });
    updateTrip(trip.id, { milestones }).catch(() => {});
  }

  function resetJourney(trip: Trip) {
    patchTrip(trip.id, { milestones: {} });
    updateTrip(trip.id, { milestones: {} }).catch(() => {});
  }

  function confirmDelete(trip: Trip) {
    Alert.alert(`Remove ${displayFlightNumber(trip.flight_number)}?`, "This stops tracking the flight.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTrip(trip.id);
            await reload();
          } catch (e) {
            Alert.alert("Couldn't remove", (e as Error).message);
          }
        },
      },
    ]);
  }

  function TripRow({ trip, isPast }: { trip: Trip; isPast?: boolean }) {
    const active = !isPast && trip.id === activeTrip?.id;
    return (
      <Pressable
        onPress={() => {
          if (isPast) return;
          selectTrip(trip.id);
          router.navigate("/");
        }}
        onLongPress={() => confirmDelete(trip)}
      >
        <Card style={active ? { borderColor: colors.primary } : undefined}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <T kind="h3">
                {displayFlightNumber(trip.flight_number)} · {trip.origin_iata} → {trip.destination_iata}
              </T>
              <T kind="caption">
                {formatDay(trip.estimated_departure, trip.origin_tz)} · {formatClock(trip.estimated_departure, trip.origin_tz)}
                {trip.gate ? ` · Gate ${trip.gate}` : ""}
              </T>
            </View>
            {isPast ? (
              <Ionicons name="checkmark-done" size={18} color={colors.muted} />
            ) : (
              <Badge tone={statusTone(trip.status)}>{trip.status}</Badge>
            )}
          </View>
          {isPast ? <JourneyStats trip={trip} /> : null}
        </Card>
      </Pressable>
    );
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <T kind="h1">Trips</T>
        <Button
          title="Add"
          variant="outline"
          onPress={() => router.push("/add-flight")}
          icon={<Ionicons name="add" size={18} color={colors.text} />}
          style={{ minHeight: 38 }}
        />
      </View>

      {activeTrip ? (
        <Card>
          <T kind="label">Active journey · {displayFlightNumber(activeTrip.flight_number)}</T>
          <Milestones trip={activeTrip} onStamp={(id) => stamp(activeTrip, id)} />
          <JourneyStats trip={activeTrip} />
          {Object.keys(activeTrip.milestones ?? {}).length > 0 ? (
            <Pressable onPress={() => resetJourney(activeTrip)}>
              <T kind="caption" color={colors.primary}>Reset journey</T>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      <T kind="label">Upcoming</T>
      {upcoming.length === 0 ? (
        <T kind="caption">No upcoming flights yet.</T>
      ) : (
        upcoming.map((t) => <TripRow key={t.id} trip={t} />)
      )}
      {upcoming.length > 0 ? <T kind="caption" style={{ fontSize: 12 }}>Press and hold a trip to remove it.</T> : null}

      {past.length > 0 ? (
        <>
          <T kind="label">Past journeys</T>
          {past.slice(0, 20).map((t) => (
            <TripRow key={t.id} trip={t} isPast />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
