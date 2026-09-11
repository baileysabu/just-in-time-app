import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Coffee, Footprints, Info, Minus, Plane, Plus, Toilet } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card } from "@/components/ui-kit";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Interactive Airport & Gate Maps — Just In Time" },
      {
        name: "description",
        content:
          "Step-by-step indoor walking directions from the Terminal B security exit straight to your departure gate.",
      },
      { property: "og:title", content: "Interactive Airport & Gate Maps — Just In Time" },
      {
        property: "og:description",
        content: "Indoor Terminal B walking directions from security to Gate B16.",
      },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  return (
    <AppShell>
      <TerminalMap />
    </AppShell>
  );
}

type Layer = "gates" | "restrooms" | "food";

const GATES = [
  { id: "b12", label: "B12", x: 150, y: 88 },
  { id: "b14", label: "B14", x: 250, y: 62 },
  { id: "b16", label: "B16", x: 330, y: 118 },
];

const RESTROOMS = [{ id: "wc1", label: "Restrooms", x: 132, y: 186 }];
const FOOD = [
  { id: "f1", label: "Coffee", x: 214, y: 178 },
  { id: "f2", label: "Dining", x: 296, y: 196 },
];

const PATH = "M42 214 C 90 214, 108 150, 158 142 S 250 150, 268 120 S 312 108, 330 118";

function TerminalMap() {
  const [layers, setLayers] = useState<Record<Layer, boolean>>({
    gates: true,
    restrooms: true,
    food: true,
  });
  const [zoom, setZoom] = useState(1);

  const toggle = (l: Layer) => setLayers((s) => ({ ...s, [l]: !s[l] }));

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-bold">Interactive Airport & Gate Maps</h1>
        <p className="text-sm text-muted-foreground">
          Get step-by-step indoor walking directions directly from the airport entrance to your
          departure gate.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["gates", "Gates"],
            ["restrooms", "Restrooms"],
            ["food", "Food"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              layers[key]
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-display font-semibold">
            <Plane className="size-4 text-primary" /> Terminal B concourse
          </p>
          <Badge tone="muted">Level 2</Badge>
        </div>

        <div className="overflow-auto rounded-2xl border border-border bg-background/60 p-2">
          <svg
            viewBox="0 0 380 250"
            role="img"
            aria-label="Terminal B indoor map with walking route from security exit to Gate B16"
            style={{ width: `${zoom * 100}%` }}
            className="h-auto min-w-full transition-[width] duration-300"
          >
            <defs>
              <filter id="neon" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* concourse shell */}
            <path
              d="M24 200 H120 V120 C120 96, 140 74, 176 62 H300 C338 62, 356 92, 356 128 V206 H24 Z"
              fill="var(--color-card)"
              stroke="var(--color-border)"
              strokeWidth="2"
            />
            <rect
              x="24"
              y="200"
              width="332"
              height="26"
              fill="var(--color-elevated)"
              stroke="var(--color-border)"
            />

            {/* walking route */}
            <path
              d={PATH}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.28"
            />
            <path
              d={PATH}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="14 12"
              filter="url(#neon)"
              className="map-route"
            />

            {/* security exit */}
            <circle cx="42" cy="214" r="7" fill="var(--color-highlight)" />
            <text x="42" y="240" textAnchor="middle" className="map-label">
              Security Exit
            </text>

            {layers.gates &&
              GATES.map((g) => (
                <g key={g.id}>
                  <rect
                    x={g.x - 18}
                    y={g.y - 13}
                    width="36"
                    height="24"
                    rx="7"
                    fill={g.id === "b16" ? "var(--color-primary)" : "var(--color-elevated)"}
                    stroke={g.id === "b16" ? "var(--color-primary)" : "var(--color-border)"}
                  />
                  <text
                    x={g.x}
                    y={g.y + 4}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill={
                      g.id === "b16" ? "var(--color-primary-foreground)" : "var(--color-foreground)"
                    }
                  >
                    {g.label}
                  </text>
                </g>
              ))}

            {layers.restrooms &&
              RESTROOMS.map((r) => (
                <g key={r.id}>
                  <circle cx={r.x} cy={r.y} r="9" fill="var(--color-elevated)" stroke="var(--color-border)" />
                  <text x={r.x} y={r.y + 22} textAnchor="middle" className="map-label">
                    {r.label}
                  </text>
                </g>
              ))}

            {layers.food &&
              FOOD.map((f) => (
                <g key={f.id}>
                  <circle cx={f.x} cy={f.y} r="9" fill="var(--color-elevated)" stroke="var(--color-border)" />
                  <text x={f.x} y={f.y + 22} textAnchor="middle" className="map-label">
                    {f.label}
                  </text>
                </g>
              ))}

            {/* info desk */}
            <circle cx="72" cy="160" r="9" fill="var(--color-elevated)" stroke="var(--color-border)" />
            <text x="72" y="182" textAnchor="middle" className="map-label">
              Info Desk
            </text>

            {/* you are here */}
            <g filter="url(#neon)">
              <circle cx="330" cy="118" r="15" fill="none" stroke="var(--color-primary)" className="map-pulse" />
              <circle cx="330" cy="118" r="6" fill="var(--color-primary)" />
            </g>
            <text x="330" y="152" textAnchor="middle" className="map-label-strong">
              You Are Here
            </text>
          </svg>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary">
            <Footprints className="size-3.5" /> 5 min walk • 320 meters • Level 2
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
            >
              <Minus className="size-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="font-display font-semibold">Points of interest</p>
        {[
          { Icon: Toilet, label: "Restrooms", detail: "Opposite Gate B12 · 1 min detour" },
          { Icon: Coffee, label: "Dining & coffee", detail: "Concourse centre · 2 min detour" },
          { Icon: Info, label: "Info desk", detail: "Near security exit" },
        ].map(({ Icon, label, detail }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl bg-background/40 p-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/15">
              <Icon className="size-4 text-primary" />
            </span>
            <div className="flex-1">
              <p className="font-semibold">{label}</p>
              <p className="text-xs text-muted-foreground">{detail}</p>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
