import { useEffect, useMemo, useRef, useState } from "react";
import { Gauge, MapPin, Mountain, Pause, Play, Plane, Timer } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui-kit";

const TOTAL_MILES = 2475;
const TOTAL_MINUTES = 375; // 6h 15m
const WAYPOINTS = [
  { t: 0, code: "JFK", name: "New York" },
  { t: 0.32, code: "ORD", name: "Chicago" },
  { t: 0.62, code: "DEN", name: "Denver" },
  { t: 1, code: "LAX", name: "Los Angeles" },
];

/** Quadratic bezier from (40,150) via (200,20) to (360,150). */
function pointAt(t: number) {
  const p0 = { x: 40, y: 150 };
  const p1 = { x: 200, y: 18 };
  const p2 = { x: 360, y: 150 };
  const mt = 1 - t;
  const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
  const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
  const dx = 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
  const dy = 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
  return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}

function fmtHM(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export function FlightRadar() {
  const [progress, setProgress] = useState(0.57);
  const [playing, setPlaying] = useState(true);
  const [mode, setMode] = useState<"map" | "telemetry">("map");
  const raf = useRef<number | null>(null);


  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setProgress((p) => (p + dt * 0.012) % 1);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing]);

  const plane = pointAt(progress);
  const phase = progress < 0.12 ? "Takeoff" : progress > 0.86 ? "Descent" : "Cruising";

  const telemetry = useMemo(() => {
    const climb = Math.min(1, progress / 0.12);
    const descend = Math.min(1, Math.max(0, (1 - progress) / 0.14));
    const factor = Math.min(climb, descend);
    const altitude = Math.round(35000 * factor + 800 * (1 - factor));
    const speed = Math.round(510 * (0.45 + 0.55 * factor));
    const traveled = Math.round(TOTAL_MILES * progress);
    const remainingMin = TOTAL_MINUTES * (1 - progress);
    const eta = new Date(Date.now() + remainingMin * 60000);
    return {
      altitude,
      speed,
      traveled,
      remaining: TOTAL_MILES - traveled,
      remainingMin,
      factor,
      cabinPsi: Math.round((14.7 - 3.6 * factor) * 10) / 10,
      outsideTemp: Math.round(59 - 111 * factor),
      eta: eta.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    };
  }, [progress]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-card p-1">
        {(
          [
            ["map", "2D Route Map"],
            ["telemetry", "Live Telemetry"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
              mode === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="space-y-4 bg-card">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-display font-semibold">
            <Plane className="size-4 text-primary" />{" "}
            {mode === "map" ? "Live route monitor" : "Avionics dashboard"}
          </p>
          <Badge tone="primary">{phase}</Badge>
        </div>

        <div className={mode === "map" ? "rounded-2xl border border-border bg-background/60 p-2" : "hidden"}>
          <svg viewBox="0 0 400 180" className="w-full" role="img" aria-label="Flight path from JFK to LAX">
            <defs>
              <linearGradient id="routeFlown" x1="0" x2="1">
                <stop offset="0%" stopColor="var(--color-primary)" />
                <stop offset="100%" stopColor="var(--color-accent)" />
              </linearGradient>
            </defs>
            <path
              d="M40,150 Q200,18 360,150"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="2.5"
              strokeDasharray="6 7"
            />
            <path
              d="M40,150 Q200,18 360,150"
              fill="none"
              stroke="url(#routeFlown)"
              strokeWidth="3.5"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - progress}
            />
            {WAYPOINTS.map((w) => {
              const p = pointAt(w.t);
              const passed = progress >= w.t;
              return (
                <g key={w.code}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={w.t === 0 || w.t === 1 ? 6 : 4}
                    fill={passed ? "var(--color-primary)" : "var(--color-card)"}
                    stroke="var(--color-primary)"
                    strokeWidth="2"
                  />
                  <text
                    x={p.x}
                    y={p.y + 22}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="var(--color-foreground)"
                  >
                    {w.code}
                  </text>
                </g>
              );
            })}
            <g transform={`translate(${plane.x} ${plane.y}) rotate(${plane.angle})`}>
              <circle r="13" fill="var(--color-primary)" opacity="0.18" />
              <path
                d="M-9,0 L5,-5 L9,0 L5,5 Z"
                fill="var(--color-primary)"
                stroke="var(--color-primary)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </div>

        {mode === "telemetry" && (
          <div className="grid grid-cols-3 gap-3 rounded-2xl border border-border bg-background/60 p-4">
            <Dial label="Altitude" value={telemetry.altitude / 40000} readout={`${Math.round(telemetry.altitude / 1000)}k ft`} />
            <Dial label="Speed" value={telemetry.speed / 600} readout={`${telemetry.speed} mph`} />
            <Dial label="Progress" value={progress} readout={`${Math.round(progress * 100)}%`} />
            <Dial
              label="Cabin press"
              value={telemetry.cabinPsi / 15}
              readout={`${telemetry.cabinPsi} psi`}
            />
            <Dial
              label="Outside temp"
              value={(telemetry.outsideTemp + 70) / 130}
              readout={`${telemetry.outsideTemp}°F`}
            />
            <Dial
              label="Distance left"
              value={telemetry.remaining / TOTAL_MILES}
              readout={`${telemetry.remaining.toLocaleString()} mi`}
            />
          </div>
        )}



        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(progress * 1000)}
            aria-label="Scrub flight progress"
            onChange={(e) => {
              setPlaying(false);
              setProgress(Number(e.target.value) / 1000);
            }}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[var(--color-primary)]"
          />
          <div className="flex items-center justify-between gap-2">
            <Button size="sm" variant="outline" onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
              {playing ? "Pause" : "Play"}
            </Button>
            <div className="flex gap-2">
              {(
                [
                  ["Takeoff", 0.04],
                  ["Cruise", 0.5],
                  ["Descent", 0.93],
                ] as const
              ).map(([label, value]) => (
                <Button
                  key={label}
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPlaying(false);
                    setProgress(value);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Tile Icon={Mountain} label="Cruising altitude" value={`${telemetry.altitude.toLocaleString()} ft`} />
        <Tile Icon={Gauge} label="Ground speed" value={`${telemetry.speed} mph`} />
        <Tile
          Icon={Timer}
          label="Time remaining"
          value={fmtHM(telemetry.remainingMin)}
          sub={`ETA ${telemetry.eta} PDT`}
        />
        <Tile
          Icon={MapPin}
          label="Distance"
          value={`${telemetry.traveled.toLocaleString()} mi flown`}
          sub={`${telemetry.remaining.toLocaleString()} mi remaining`}
        />
      </div>
    </div>
  );
}

function Tile({
  Icon,
  label,
  value,
  sub,
}: {
  Icon: typeof Gauge;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="space-y-1 p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        <Icon className="size-3.5 text-primary" /> {label}
      </p>
      <p className="font-display text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function Dial({ label, value, readout }: { label: string; value: number; readout: string }) {
  const pct = Math.max(0, Math.min(1, value));
  const r = 26;
  const circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-border)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ}`}
        />
      </svg>
      <p className="font-display text-sm font-bold tabular-nums">{readout}</p>
      <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
