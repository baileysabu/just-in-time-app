import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BedDouble,
  Car,
  CheckCircle2,
  Crown,
  Globe,
  Map as MapIcon,
  Minus,
  ParkingSquare,
  Plane,
  Plus,
  ShieldCheck,
  Timer,
  Footprints,
  Ticket,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { FlightRadar } from "@/components/flight-radar";
import { ProModal } from "@/components/pro-modal";
import { MilestoneTracker, NewTripButton, TripSelector } from "@/components/trip-management";
import { TravelServices } from "@/components/travel-services";
import { Badge, Button, Card } from "@/components/ui-kit";
import { formatClock, formatDuration, useAppStore } from "@/lib/app-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Just In Time — Leave-by timer for your next flight" },
      {
        name: "description",
        content:
          "Track your flight, get a live leave-by countdown, and see a door-to-gate breakdown of drive, TSA, walk and boarding times.",
      },
      { property: "og:title", content: "Just In Time — Leave-by timer for your next flight" },
      {
        property: "og:description",
        content: "Your airport assistant: live leave-by countdown and door-to-gate timing.",
      },
    ],
  }),
  component: HomePage,
});

const SEGMENT_ICONS: Record<string, typeof Car> = {
  drive: Car,
  tsa: ShieldCheck,
  walk: Footprints,
  boarding: Ticket,
};

const PARTNERS = [
  {
    name: "Uber",
    Icon: Car,
    tag: "Ride in ~6 min",
    copy: "UberX to JFK Terminal 8 · est. $61",
    cta: "Book ride",
  },
  {
    name: "Booking.com",
    Icon: BedDouble,
    tag: "LAX hotels",
    copy: "Free cancellation near your arrival gate",
    cta: "Find a stay",
  },
  {
    name: "JFK Airport Parking",
    Icon: ParkingSquare,
    tag: "Save 28%",
    copy: "Long-term lot with shuttle every 8 min",
    cta: "Reserve spot",
  },
  {
    name: "Airalo eSIM",
    Icon: Globe,
    tag: "Instant data",
    copy: "5GB US plan, activates before wheels up",
    cta: "Get eSIM",
  },
];

function HomePage() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

function Dashboard() {
  const {
    segments,
    setSegmentMinutes,
    totalMinutes,
    effectiveDepartureISO,
    departureISO,
    scenario,
    setScenario,
    gate,
    flightStatus,
    delayMinutes,
    extraWalkMinutes,
    pro,
    user,
    activeTrip,
  } = useAppStore();
  const [now, setNow] = useState(() => Date.now());
  const [proOpen, setProOpen] = useState(false);
  const [view, setView] = useState<"preflight" | "inflight">("preflight");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const departure = new Date(effectiveDepartureISO).getTime();
  const leaveBy = departure - totalMinutes * 60 * 1000;
  const msUntilLeave = leaveBy - now;
  const late = msUntilLeave <= 0;
  const tight = !late && msUntilLeave < 20 * 60 * 1000;
  const tone = late ? "danger" : tight ? "warning" : "success";
  const statusText = late ? "Leave now — you're behind" : tight ? "Cutting it close" : "On track";

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Good travels</p>
          <h1 className="font-display text-2xl font-bold">
            {user?.email.split("@")[0] ?? "Traveler"}
          </h1>
        </div>
        <div data-tour="sync" className="flex items-center gap-2 rounded-2xl">
          <NewTripButton label />
          <button onClick={() => setProOpen(true)}>
            <Badge tone={pro ? "success" : "accent"}>
              <Crown className="size-3" /> {pro ? "Pro" : "Go Pro"}
            </Badge>
          </button>
        </div>
      </header>

      <TripSelector />

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Flight scenario
        </p>
        <div className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-card p-1">
          {(
            [
              ["ontime", "On Time"],
              ["delayed", "Delayed +25m"],
              ["gate", "Gate change"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setScenario(key)}
              className={`rounded-xl px-2 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                scenario === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {scenario === "gate" && (
        <Card className="flex items-start gap-3 border-warning/50 bg-warning/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            <p className="font-display font-bold text-warning">Gate change: {activeTrip.gate} → C4</p>
            <p className="text-sm text-muted-foreground">
              New gate is in a different pier — walk time increased by {extraWalkMinutes} minutes.
            </p>
          </div>
        </Card>
      )}

      {scenario === "delayed" && (
        <Card className="flex items-start gap-3 border-accent/50 bg-accent/10 p-4">
          <Timer className="mt-0.5 size-5 shrink-0 text-accent" />
          <div>
            <p className="font-display font-bold">Departure delayed 25 minutes</p>
            <p className="text-sm text-muted-foreground">
              New departure {formatClock(effectiveDepartureISO)} · boarding and leave-by shifted
              automatically.
            </p>
          </div>
        </Card>
      )}

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {activeTrip.airline}
            </p>
            <h2 className="font-display text-2xl font-bold">{activeTrip.flight}</h2>
          </div>
          <Badge tone={scenario === "ontime" ? "success" : scenario === "delayed" ? "warning" : "accent"}>
            {flightStatus}
          </Badge>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-background/50 p-4">
          <div>
            <p className="font-display text-3xl font-bold">{activeTrip.origin}</p>
            <p className="text-xs text-muted-foreground">
              {delayMinutes > 0 ? (
                <>
                  <span className="line-through">{formatClock(departureISO)}</span>{" "}
                  {formatClock(effectiveDepartureISO)} departure
                </>
              ) : (
                <>{formatClock(effectiveDepartureISO)} departure</>
              )}
            </p>
          </div>
          <Plane className="size-5 text-primary" />
          <div className="text-right">
            <p className="font-display text-3xl font-bold">{activeTrip.destination}</p>
            <p className="text-xs text-muted-foreground">
              {Math.floor(activeTrip.durationMinutes / 60)}h {activeTrip.durationMinutes % 60}m flight
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Terminal", activeTrip.terminal],
            ["Gate", gate],
            ["Boarding grp", activeTrip.boardingGroup],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-background/50 py-3">
              <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</dt>
              <dd className="font-display text-lg font-bold">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-card p-1">
        {(
          [
            ["preflight", "Pre-Flight"],
            ["inflight", "In-Flight"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`rounded-xl px-3 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              view === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "inflight" && <FlightRadar />}

      {view === "preflight" && (
      <>
      <Card>
        <MilestoneTracker compact />
      </Card>
      <Card data-tour="leaveby" className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-display font-semibold">
            <Timer className="size-4 text-primary" /> Leave-by timer
          </p>
          <Badge tone={tone}>
            {late ? <AlertTriangle className="size-3" /> : <CheckCircle2 className="size-3" />}
            {statusText}
          </Badge>
        </div>
        <p
          className={`font-display text-5xl font-bold tabular-nums ${
            late ? "text-destructive" : "text-glow-yellow"
          }`}
        >
          {late ? "00:00:00" : formatDuration(msUntilLeave)}
        </p>
        <p className="text-sm text-muted-foreground">
          Leave home by{" "}
          <span className="font-semibold text-foreground">
            {formatClock(new Date(leaveBy).toISOString())}
          </span>{" "}
          · {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m door to gate
        </p>
      </Card>

      <Card className="space-y-3">
        <p className="font-display font-semibold">Door-to-gate breakdown</p>
        {segments.map((s, i) => {
          const Icon = SEGMENT_ICONS[s.id] ?? Car;
          return (
            <div key={s.id} className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/15">
                  <Icon className="size-4 text-primary" />
                </span>
                {i < segments.length - 1 && <span className="my-1 h-6 w-px bg-border" />}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{s.label}</p>
                <p className="text-xs text-muted-foreground">
                  {s.id === "drive"
                    ? `Home → ${activeTrip.origin} Terminal ${activeTrip.terminal}`
                    : s.id === "walk"
                      ? `Checkpoint → Gate ${gate}`
                      : s.id === "boarding"
                        ? `Group ${activeTrip.boardingGroup} · doors close T-15`
                        : s.detail}
                  {s.id === "walk" && extraWalkMinutes > 0 && (
                    <span className="ml-1 font-semibold text-warning">
                      +{extraWalkMinutes}m gate change
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  aria-label={`Decrease ${s.label}`}
                  onClick={() => setSegmentMinutes(s.id, s.minutes - 5)}
                  className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:text-foreground"
                >
                  <Minus className="size-3" />
                </button>
                <span className="w-14 text-center font-display font-bold tabular-nums">
                  {s.id === "walk" ? s.minutes + extraWalkMinutes : s.minutes}m
                </span>
                <button
                  aria-label={`Increase ${s.label}`}
                  onClick={() => setSegmentMinutes(s.id, s.minutes + 5)}
                  className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:text-foreground"
                >
                  <Plus className="size-3" />
                </button>
              </div>
            </div>
          );
        })}
        <Link to="/map" className="block">
          <Button variant="outline" size="sm" className="w-full">
            <MapIcon className="size-3.5" /> View terminal map
          </Button>
        </Link>
      </Card>
      </>
      )}

      {!pro && (
        <Card className="space-y-3 border-accent/40 bg-accent/10">
          <Badge tone="accent">
            <Crown className="size-3" /> Pro Pass
          </Badge>
          <p className="font-display text-lg font-bold">Live TSA alerts and zero ads</p>
          <p className="text-sm text-muted-foreground">
            Unlock automated door-to-gate sync and priority airport transfers.
          </p>
          <Button className="w-full" onClick={() => setProOpen(true)}>
            See plans
          </Button>
        </Card>
      )}

      <TravelServices />

      <section className="space-y-3">
        <p className="font-display font-semibold">Ready for your trip</p>
        {PARTNERS.map(({ name, Icon, tag, copy, cta }) => (
          <Card key={name} className="flex items-center gap-3 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-background/60">
              <Icon className="size-5 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold">{name}</p>
                <Badge tone="muted">{tag}</Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">{copy}</p>
            </div>
            <Button size="sm" variant="outline">
              {cta}
            </Button>
          </Card>
        ))}
        <p className="text-center text-[11px] text-muted-foreground">
          Partner links may earn Just In Time a commission.
        </p>
      </section>

      <ProModal open={proOpen} onClose={() => setProOpen(false)} />
    </div>
  );
}
