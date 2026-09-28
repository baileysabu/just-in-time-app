import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, RefreshControl, View } from "react-native";
import { Breakdown, FlightCard, LeaveByCard, Milestones, TripSelector } from "@/components/trip";
import { Badge, Button, Card, Screen, T } from "@/components/ui";
import { updateTrip } from "@/lib/api";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/config";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";
import type { SegmentId } from "@/lib/timing";
import type { MilestoneId } from "@/lib/types";
import { useTiming } from "@/lib/useTiming";

export default function Home() {
  const { session, profile, isPro, upcoming, activeTrip, selectTrip, refreshActive, patchTrip, alerts } = useApp();
  const timing = useTiming(activeTrip, profile);
  const [refreshing, setRefreshing] = useState(false);
  const name = session?.user.email?.split("@")[0] ?? "Traveler";

  // Refresh flight status + drive time whenever Home comes into view
  useFocusEffect(
    useCallback(() => {
      refreshActive().then(showChanges);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTrip?.id]),
  );

  function showChanges(messages: string[]) {
    if (messages.length) Alert.alert("Flight update", messages.join("\n\n"));
  }

  async function onRefresh() {
    setRefreshing(true);
    showChanges(await refreshActive({ force: true }));
    setRefreshing(false);
  }

  function adjust(id: SegmentId, delta: number) {
    if (!activeTrip) return;
    const overrides = { ...activeTrip.segment_overrides, [id]: (activeTrip.segment_overrides?.[id] ?? 0) + delta };
    patchTrip(activeTrip.id, { segment_overrides: overrides });
    updateTrip(activeTrip.id, { segment_overrides: overrides }).catch(() => {});
  }

  function stamp(id: MilestoneId) {
    if (!activeTrip) return;
    const milestones = { ...activeTrip.milestones, [id]: new Date().toISOString() };
    patchTrip(activeTrip.id, { milestones });
    updateTrip(activeTrip.id, { milestones }).catch(() => {});
  }

  const latestAlert = activeTrip ? alerts.find((a) => a.trip_id === activeTrip.id) : undefined;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <T kind="label">Good travels</T>
          <T kind="h1" numberOfLines={1}>{name}</T>
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {SUBSCRIPTIONS_ENABLED ? (
            <Pressable onPress={() => router.push("/paywall")} accessibilityLabel="Pro">
              <Badge tone={isPro ? "success" : "primary"}>{isPro ? "★ Pro" : "Go Pro"}</Badge>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel="Add flight"
            onPress={() => router.push("/add-flight")}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="add" size={22} color={colors.primaryText} />
          </Pressable>
        </View>
      </View>

      {!activeTrip || !timing ? (
        <Card style={{ alignItems: "center", paddingVertical: 36 }}>
          <Ionicons name="airplane-outline" size={40} color={colors.primary} />
          <T kind="h2">No upcoming flights</T>
          <T kind="caption" style={{ textAlign: "center" }}>
            Add your flight number and we'll tell you exactly when to leave for the airport.
          </T>
          <Button title="Add a flight" onPress={() => router.push("/add-flight")} style={{ alignSelf: "stretch" }} />
        </Card>
      ) : (
        <>
          <TripSelector trips={upcoming} activeId={activeTrip.id} onSelect={selectTrip} />
          {latestAlert && Date.now() - Date.parse(latestAlert.created_at) < 6 * 3600_000 ? (
            <Card style={{ borderColor: colors.warning + "88", backgroundColor: colors.warning + "12", flexDirection: "row", gap: 10 }}>
              <Ionicons name="warning-outline" size={20} color={colors.warning} />
              <T style={{ flex: 1 }}>{latestAlert.message}</T>
            </Card>
          ) : null}
          <FlightCard trip={activeTrip} />
          <LeaveByCard leaveBy={timing.leaveBy} segments={timing.segments} canceled={activeTrip.status === "Canceled"} />
          <Card>
            <Milestones trip={activeTrip} onStamp={stamp} compact />
          </Card>
          <Breakdown trip={activeTrip} segments={timing.segments} onAdjust={adjust} />
          {SUBSCRIPTIONS_ENABLED && !isPro ? (
            <Card style={{ borderColor: colors.primary + "66", backgroundColor: colors.primary + "12" }}>
              <Badge tone="primary">Pro Pass</Badge>
              <T kind="h3">Live delay & gate alerts</T>
              <T kind="caption">
                We'll watch your flight every 10 minutes and push you the moment it's delayed, canceled or changes gate.
              </T>
              <Button title="See plans" onPress={() => router.push("/paywall")} />
            </Card>
          ) : null}
          <T kind="caption" style={{ textAlign: "center", fontSize: 12 }}>
            Security and walk times are estimates. Always follow your airline's guidance.
          </T>
        </>
      )}
    </Screen>
  );
}
