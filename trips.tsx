import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MilestoneTracker, NewTripButton, TripSelector } from "@/components/trip-management";
import { Button, Card } from "@/components/ui-kit";
import { useAppStore } from "@/lib/app-store";

export const Route = createFileRoute("/trips")({
  head: () => ({
    meta: [
      { title: "Trip Journey Log — Just In Time" },
      {
        name: "description",
        content:
          "Stamp airport milestones as they happen and see your average check-in and walk-to-gate times.",
      },
      { property: "og:title", content: "Trip Journey Log — Just In Time" },
      {
        property: "og:description",
        content: "Stamp milestones and track your personal airport timing averages.",
      },
    ],
  }),
  component: TripsPage,
});

type Preview = "live" | "empty" | "loading" | "completed";

function TripsPage() {
  return (
    <AppShell>
      <Trips />
    </AppShell>
  );
}

function Trips() {
  const { milestones, resetJourney, history, activeTrip } = useAppStore();
  const [preview, setPreview] = useState<Preview>("live");

  const times = (() => {
    const at = (id: string) => milestones.find((m) => m.id === id)?.stampedAt;
    const mins = (a?: string | null, b?: string | null) =>
      a && b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)) : null;
    return {
      checkIn: mins(at("left"), at("arrived")),
      walk: mins(at("security"), at("gate")),
    };
  })();

  const histCheckIn = Math.round(
    history.reduce((s, t) => s + t.checkInMinutes, 0) / history.length,
  );
  const histWalk = Math.round(history.reduce((s, t) => s + t.walkMinutes, 0) / history.length);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Active trip journey log</h1>
          <p className="text-sm text-muted-foreground">{activeTrip.flight} · {activeTrip.origin} → {activeTrip.destination}</p>
        </div>
        <NewTripButton />
      </header>

      <TripSelector />

      <Card className="space-y-3">
        <MilestoneTracker />
        <Button variant="ghost" size="sm" className="w-full" onClick={resetJourney}>
          <RotateCcw className="size-3" /> Reset journey log
        </Button>
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display font-semibold">Analytics</p>
          <div className="flex flex-wrap gap-1">
            {(["live", "empty", "loading", "completed"] as Preview[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreview(p)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize ${
                  preview === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {preview === "loading" ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Crunching your timings…
          </div>
        ) : preview === "empty" ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No stamps yet. Tap a milestone above and we'll start measuring your pace.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="Average check-in time"
              value={
                preview === "completed"
                  ? `${histCheckIn}m`
                  : times.checkIn !== null
                    ? `${times.checkIn}m`
                    : "—"
              }
              hint={preview === "completed" ? "Across 3 past trips" : "Left home → airport"}
            />
            <Stat
              label="Average walk-to-gate"
              value={
                preview === "completed"
                  ? `${histWalk}m`
                  : times.walk !== null
                    ? `${times.walk}m`
                    : "—"
              }
              hint={preview === "completed" ? "Across 3 past trips" : "Security → gate"}
            />
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <p className="font-display font-semibold">Saved journey logs</p>
        {history.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-xl bg-background/40 p-3"
          >
            <div>
              <p className="font-semibold">{t.route}</p>
              <p className="text-xs text-muted-foreground">
                {t.flight} · {t.date}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Check-in {t.checkInMinutes}m</p>
              <p>Walk {t.walkMinutes}m</p>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl bg-background/50 p-4">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-display text-3xl font-bold text-glow-yellow">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
