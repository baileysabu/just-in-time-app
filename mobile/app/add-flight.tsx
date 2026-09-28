import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { statusTone } from "@/components/trip";
import { Badge, Button, Card, Input, Screen, T } from "@/components/ui";
import { addTrip, lookupFlight, UserError } from "@/lib/api";
import { scanCalendarForFlights } from "@/lib/calendar";
import { displayFlightNumber, localDateString, normalizeFlightNumber, type FlightCandidate } from "@/lib/flights";
import { formatClock, formatDay } from "@/lib/format";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/config";
import { useApp } from "@/lib/store";
import { colors, fonts, radius } from "@/lib/theme";
import type { FlightInfo } from "@/lib/types";

function nextDays(n: number) {
  const out: { value: string; label: string; sub: string }[] = [];
  const base = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    out.push({
      value: localDateString(d),
      label: i === 0 ? "Today" : i === 1 ? "Tmrw" : d.toLocaleDateString("en-US", { weekday: "short" }),
      sub: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
  }
  return out;
}

export default function AddFlight() {
  const { session, selectTrip, reload } = useApp();
  const days = useMemo(() => nextDays(30), []);
  const [flightText, setFlightText] = useState("");
  const [date, setDate] = useState(days[0].value);
  const [preview, setPreview] = useState<{ info: FlightInfo; date: string } | null>(null);
  const [loading, setLoading] = useState<"lookup" | "save" | "calendar" | null>(null);
  const [candidates, setCandidates] = useState<FlightCandidate[] | null>(null);

  async function find(flightInput = flightText, flightDate = date) {
    const flight = normalizeFlightNumber(flightInput);
    if (!flight) {
      Alert.alert("Check the flight number", "Enter the airline code and number, like AA1204 or B6 23.");
      return;
    }
    setLoading("lookup");
    setPreview(null);
    try {
      const info = await lookupFlight(flight, flightDate);
      setPreview({ info, date: flightDate });
    } catch (e) {
      Alert.alert("Flight not found", e instanceof UserError ? e.message : "Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function save() {
    if (!preview || !session) return;
    setLoading("save");
    try {
      const trip = await addTrip(session.user.id, preview.info, preview.date);
      await reload();
      selectTrip(trip.id);
      router.back();
    } catch (e) {
      if (SUBSCRIPTIONS_ENABLED && e instanceof UserError && e.message === "FREE_TRIP_LIMIT") {
        Alert.alert(
          "Free plan limit",
          "The free plan tracks 2 upcoming flights. Upgrade to Pro for unlimited trips and live alerts.",
          [
            { text: "Not now", style: "cancel" },
            { text: "See Pro", onPress: () => router.replace("/paywall") },
          ],
        );
      } else {
        Alert.alert("Couldn't add flight", (e as Error).message);
      }
    } finally {
      setLoading(null);
    }
  }

  async function importCalendar() {
    setLoading("calendar");
    try {
      const res = await scanCalendarForFlights();
      if (res === "denied") {
        Alert.alert("Calendar access is off", "Turn it on in Settings to import flights.", [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]);
      } else {
        setCandidates(res);
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen edges={["bottom"]}>
        <Input
          label="Flight number"
          value={flightText}
          onChangeText={(t) => {
            setFlightText(t);
            setPreview(null);
          }}
          placeholder="e.g. AA1204"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => find()}
        />

        <View style={{ gap: 6 }}>
          <T kind="label">Departure date</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {days.map((d) => {
              const active = d.value === date;
              return (
                <Pressable
                  key={d.value}
                  onPress={() => {
                    setDate(d.value);
                    setPreview(null);
                  }}
                  style={{
                    width: 62,
                    paddingVertical: 10,
                    alignItems: "center",
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary + "1F" : colors.card,
                  }}
                >
                  <Text style={{ fontFamily: fonts.bodySemi, color: active ? colors.primary : colors.text }}>{d.label}</Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>{d.sub}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <Button title="Find flight" onPress={() => find()} loading={loading === "lookup"} />

        {preview ? (
          <Card style={{ borderColor: colors.primary }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <T kind="label">{preview.info.airline}</T>
                <T kind="h2">{displayFlightNumber(preview.info.flight)}</T>
              </View>
              <Badge tone={statusTone(preview.info.status)}>{preview.info.status}</Badge>
            </View>
            <T kind="h3">
              {preview.info.originIata} → {preview.info.destinationIata}
            </T>
            <T kind="caption">
              {preview.info.originName} → {preview.info.destinationName}
              {"\n"}
              Departs {formatClock(preview.info.estimatedDeparture, preview.info.originTimeZone)} ·{" "}
              {formatDay(preview.info.estimatedDeparture, preview.info.originTimeZone)}
              {preview.info.terminal ? ` · Terminal ${preview.info.terminal}` : ""}
              {preview.info.gate ? ` · Gate ${preview.info.gate}` : ""}
            </T>
            <Button title="Track this flight" onPress={save} loading={loading === "save"} />
          </Card>
        ) : null}

        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <T kind="h3">Import from Calendar</T>
          </View>
          <T kind="caption">
            We'll look for flight numbers in your calendar events for the next 90 days. Nothing leaves your phone except the flights you pick.
          </T>
          {candidates === null ? (
            <Button title="Scan my calendar" variant="outline" onPress={importCalendar} loading={loading === "calendar"} />
          ) : candidates.length === 0 ? (
            <T kind="caption">No flights found in your calendar.</T>
          ) : (
            candidates.map((c) => (
              <Pressable
                key={`${c.flight}-${c.date}`}
                onPress={() => {
                  setFlightText(c.flight);
                  setDate(c.date);
                  find(c.flight, c.date);
                }}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 8,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <T style={{ fontFamily: fonts.bodySemi }}>
                    {displayFlightNumber(c.flight)} · {c.date}
                  </T>
                  <T kind="caption" numberOfLines={1}>{c.sourceTitle}</T>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))
          )}
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
