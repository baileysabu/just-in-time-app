import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { displayFlightNumber } from "@/lib/flights";
import { formatClock, formatDay } from "@/lib/format";
import { colors, fonts, radius } from "@/lib/theme";
import {
  formatCountdown,
  formatMinutes,
  leaveStatus,
  totalMinutes,
  type Segment,
  type SegmentId,
} from "@/lib/timing";
import { MILESTONES, type MilestoneId, type Trip } from "@/lib/types";
import { Badge, Card, T, type Tone } from "./ui";

export function statusTone(status: string): Tone {
  if (status === "Canceled") return "danger";
  if (status === "Delayed" || status === "Gate closed") return "warning";
  if (status === "Boarding" || status === "Departed") return "primary";
  return "success";
}

// ── Horizontal trip picker ──────────────────────────────────
export function TripSelector({
  trips,
  activeId,
  onSelect,
}: {
  trips: Trip[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  if (trips.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {trips.map((t) => {
        const active = t.id === activeId;
        return (
          <Pressable
            key={t.id}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onSelect(t.id);
            }}
            style={[st.chip, active && { borderColor: colors.primary, backgroundColor: colors.primary + "1A" }]}
          >
            <Text style={[st.chipTitle, active && { color: colors.primary }]}>
              {displayFlightNumber(t.flight_number)}
            </Text>
            <Text style={st.chipSub}>
              {t.origin_iata} → {t.destination_iata} · {formatDay(t.estimated_departure, t.origin_tz)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ── Flight summary card ─────────────────────────────────────
export function FlightCard({ trip }: { trip: Trip }) {
  const delayed = trip.estimated_departure !== trip.scheduled_departure;
  return (
    <Card>
      <View style={st.between}>
        <View style={{ flex: 1 }}>
          <T kind="label">{trip.airline || "Flight"}</T>
          <T kind="h2">{displayFlightNumber(trip.flight_number)}</T>
        </View>
        <Badge tone={statusTone(trip.status)}>{trip.status}</Badge>
      </View>
      <View style={st.route}>
        <View>
          <Text style={st.iata}>{trip.origin_iata}</Text>
          <T kind="caption">
            {delayed ? (
              <Text style={{ textDecorationLine: "line-through" }}>
                {formatClock(trip.scheduled_departure, trip.origin_tz)}{" "}
              </Text>
            ) : null}
            {formatClock(trip.estimated_departure, trip.origin_tz)} · {formatDay(trip.estimated_departure, trip.origin_tz)}
          </T>
        </View>
        <Ionicons name="airplane" size={20} color={colors.primary} />
        <View style={{ alignItems: "flex-end" }}>
          <Text style={st.iata}>{trip.destination_iata}</Text>
          <T kind="caption">
            {trip.duration_minutes ? `${formatMinutes(trip.duration_minutes)} flight` : trip.destination_name}
          </T>
        </View>
      </View>
      <View style={st.grid}>
        {[
          ["Terminal", trip.terminal ?? "—"],
          ["Gate", trip.gate ?? "TBD"],
          ["Boarding grp", trip.boarding_group ?? "—"],
        ].map(([k, v]) => (
          <View key={k} style={st.cell}>
            <T kind="label" style={{ fontSize: 10 }}>{k}</T>
            <Text style={st.cellValue}>{v}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

// ── Live leave-by countdown ─────────────────────────────────
export function LeaveByCard({ leaveBy, segments, canceled }: { leaveBy: Date; segments: Segment[]; canceled: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = leaveBy.getTime() - now;
  const status = leaveStatus(ms);
  const tone: Tone = status === "late" ? "danger" : status === "tight" ? "warning" : "success";
  const label = status === "late" ? "Leave now — you're behind" : status === "tight" ? "Cutting it close" : "On track";

  if (canceled) {
    return (
      <Card style={{ borderColor: colors.danger + "88" }}>
        <T kind="h3" color={colors.danger}>Flight canceled</T>
        <T kind="caption">Check your airline's app to rebook, then add your new flight here.</T>
      </Card>
    );
  }

  return (
    <Card>
      <View style={st.between}>
        <View style={st.row}>
          <Ionicons name="timer-outline" size={18} color={colors.primary} />
          <T kind="h3">Leave-by timer</T>
        </View>
        <Badge tone={tone}>{label}</Badge>
      </View>
      <T kind="big" color={status === "late" ? colors.danger : colors.highlight}>
        {formatCountdown(ms)}
      </T>
      <T kind="caption">
        Leave by <Text style={{ color: colors.text, fontFamily: fonts.bodySemi }}>{formatClock(leaveBy)}</Text>
        {" · "}
        {formatMinutes(totalMinutes(segments))} door to gate
      </T>
    </Card>
  );
}

// ── Door-to-gate breakdown with +/- adjusters ───────────────
const ICONS: Record<SegmentId, keyof typeof Ionicons.glyphMap> = {
  drive: "car-outline",
  tsa: "shield-checkmark-outline",
  walk: "walk-outline",
  boarding: "ticket-outline",
};

export function Breakdown({
  trip,
  segments,
  onAdjust,
}: {
  trip: Trip;
  segments: Segment[];
  onAdjust: (id: SegmentId, delta: number) => void;
}) {
  const detail: Record<SegmentId, string> = {
    drive: trip.drive_is_live
      ? `Live traffic → ${trip.origin_iata}${trip.terminal ? ` T${trip.terminal}` : ""}`
      : trip.drive_minutes != null
        ? `Estimate → ${trip.origin_iata} (turn on location for live traffic)`
        : `Default — allow location for your real drive`,
    tsa: "Estimated for this airport & time of day",
    walk: `Checkpoint → Gate ${trip.gate ?? "TBD"}`,
    boarding: "Be at the gate before boarding starts",
  };
  return (
    <Card>
      <T kind="h3">Door-to-gate breakdown</T>
      {segments.map((seg, i) => (
        <View key={seg.id} style={st.segRow}>
          <View style={{ alignItems: "center" }}>
            <View style={st.segIcon}>
              <Ionicons name={ICONS[seg.id]} size={17} color={colors.primary} />
            </View>
            {i < segments.length - 1 ? <View style={st.segLine} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: fonts.bodySemi }}>
              {seg.label}
              {seg.live ? <Text style={{ color: colors.highlight }}>  ● live</Text> : null}
            </T>
            <T kind="caption">{detail[seg.id]}</T>
          </View>
          <View style={st.row}>
            <Adjust icon="remove" label={`Decrease ${seg.label}`} onPress={() => onAdjust(seg.id, -5)} />
            <Text style={st.minutes}>{seg.minutes}m</Text>
            <Adjust icon="add" label={`Increase ${seg.label}`} onPress={() => onAdjust(seg.id, 5)} />
          </View>
        </View>
      ))}
    </Card>
  );
}

function Adjust({ icon, label, onPress }: { icon: "add" | "remove"; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={st.adjust}
    >
      <Ionicons name={icon} size={14} color={colors.muted} />
    </Pressable>
  );
}

// ── Journey milestones ──────────────────────────────────────
export function Milestones({
  trip,
  onStamp,
  compact,
}: {
  trip: Trip;
  onStamp: (id: MilestoneId) => void;
  compact?: boolean;
}) {
  const nextId = MILESTONES.find((m) => !trip.milestones?.[m.id])?.id;
  return (
    <View style={{ gap: 10 }}>
      <View style={st.between}>
        <T kind="h3">Journey</T>
        <T kind="caption">
          {MILESTONES.filter((m) => trip.milestones?.[m.id]).length}/{MILESTONES.length}
        </T>
      </View>
      <View style={[st.row, { flexWrap: "wrap" }]}>
        {MILESTONES.map((m) => {
          const at = trip.milestones?.[m.id];
          const isNext = m.id === nextId;
          return (
            <Pressable
              key={m.id}
              disabled={!!at || !isNext}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                onStamp(m.id);
              }}
              style={[
                st.milestone,
                at && { borderColor: colors.highlight + "88", backgroundColor: colors.highlight + "14" },
                isNext && { borderColor: colors.primary },
              ]}
            >
              <Ionicons
                name={at ? "checkmark-circle" : isNext ? "radio-button-on" : "ellipse-outline"}
                size={15}
                color={at ? colors.highlight : isNext ? colors.primary : colors.muted}
              />
              <Text style={[st.milestoneText, { color: at ? colors.text : isNext ? colors.primary : colors.muted }]}>
                {m.label}
                {at && !compact ? ` · ${formatClock(at)}` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {nextId && !compact ? <T kind="caption">Tap the highlighted step when you reach it.</T> : null}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipTitle: { fontFamily: fonts.display, fontSize: 15, color: colors.text },
  chipSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  route: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background + "AA",
    borderRadius: radius.lg,
    padding: 16,
  },
  iata: { fontFamily: fonts.display, fontSize: 30, color: colors.text },
  grid: { flexDirection: "row", gap: 8 },
  cell: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.background + "AA",
    borderRadius: radius.md,
    paddingVertical: 12,
    gap: 2,
  },
  cellValue: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  segRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  segIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  segLine: { width: 1, height: 18, backgroundColor: colors.border, marginTop: 4 },
  minutes: { width: 46, textAlign: "center", fontFamily: fonts.display, fontSize: 16, color: colors.text },
  adjust: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  milestone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  milestoneText: { fontFamily: fonts.bodySemi, fontSize: 12 },
});
