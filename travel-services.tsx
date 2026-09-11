import { useState } from "react";
import {
  BadgeCheck,
  Car,
  CheckCircle2,
  Clock,
  Globe2,
  MapPin,
  QrCode,
  Signal,
  Smartphone,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, Modal } from "@/components/ui-kit";
import { formatClock, useAppStore } from "@/lib/app-store";
import { cn } from "@/lib/utils";

/* ------------------------------- eSIM panel ------------------------------- */

const DESTINATIONS = [
  { id: "us", label: "United States", flag: "🇺🇸", carrier: "T-Mobile / AT&T" },
  { id: "uk", label: "United Kingdom", flag: "🇬🇧", carrier: "EE / Vodafone" },
  { id: "jp", label: "Japan", flag: "🇯🇵", carrier: "NTT Docomo" },
  { id: "eu", label: "Europe (EU)", flag: "🇪🇺", carrier: "39 countries" },
] as const;

const PLANS = [
  { id: "s", data: "3GB", days: 7, price: 9 },
  { id: "m", data: "5GB", days: 15, price: 14 },
  { id: "l", data: "10GB", days: 30, price: 24 },
] as const;

export function EsimPanel() {
  const [dest, setDest] = useState<(typeof DESTINATIONS)[number]["id"]>("us");
  const [plan, setPlan] = useState<(typeof PLANS)[number]["id"]>("m");
  const [open, setOpen] = useState(false);
  const destination = DESTINATIONS.find((d) => d.id === dest)!;
  const selected = PLANS.find((p) => p.id === plan)!;

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-display font-semibold">
            <Globe2 className="size-4 text-primary" /> eSIM &amp; International Data
          </p>
          <p className="text-xs text-muted-foreground">
            Instant activation — no physical SIM, no roaming bills.
          </p>
        </div>
        <Badge tone="primary">Instant</Badge>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Destination
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DESTINATIONS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDest(d.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors",
                d.id === dest
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="text-base">{d.flag}</span>
              <span className="truncate">{d.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Data plan · {destination.carrier}
        </p>
        <div className="space-y-2">
          {PLANS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlan(p.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                p.id === plan ? "border-primary bg-primary/10" : "border-border bg-background/40",
              )}
            >
              <Signal className={cn("size-4", p.id === plan ? "text-primary" : "text-muted-foreground")} />
              <span className="flex-1 text-sm font-semibold">
                {p.data} / {p.days} Days
              </span>
              <span className="font-display text-lg font-bold text-accent">${p.price}</span>
            </button>
          ))}
        </div>
      </div>

      <Button
        className="w-full"
        variant="accent"
        onClick={() => {
          setOpen(true);
          toast.success("eSIM purchased", {
            description: `${selected.data} · ${destination.label} — ready to install.`,
          });
        }}
      >
        <Smartphone className="size-4" /> Activate eSIM · ${selected.price}
      </Button>

      <EsimInstallModal
        open={open}
        onClose={() => setOpen(false)}
        destination={destination.label}
        planLabel={`${selected.data} / ${selected.days} days`}
      />
    </Card>
  );
}

function EsimInstallModal({
  open,
  onClose,
  destination,
  planLabel,
}: {
  open: boolean;
  onClose: () => void;
  destination: string;
  planLabel: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Install your eSIM">
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-background/50 p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{destination}</p>
          <p className="font-display text-lg font-bold">{planLabel}</p>
          <div className="mx-auto mt-3 flex size-40 items-center justify-center rounded-2xl bg-foreground p-3">
            <QrCode className="size-full text-background" strokeWidth={1} />
          </div>
          <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <QrCode className="size-3" /> Scan with the phone that will use the eSIM
          </p>
        </div>

        <div className="space-y-2">
          {[
            ["SM-DP+ Address", "consumer.rsp.jit-mobile.com"],
            ["Activation code", "K2-8JQ4-ZR71-TF09"],
            ["ICCID", "8944 5000 1234 5678 901"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex items-center justify-between gap-3 rounded-xl bg-background/50 px-3 py-2"
            >
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{k}</span>
              <span className="truncate font-mono text-xs font-semibold">{v}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="font-display font-semibold">Setup guide</p>
          {[
            "Open Settings → Cellular / Mobile Data.",
            "Tap “Add eSIM”, then “Use QR Code”.",
            "Scan the code above, or enter the SM-DP+ address and activation code manually.",
            "Label the plan “Just In Time” and turn on Data Roaming for it.",
            "Keep your primary line for calls and texts — data runs on the eSIM.",
          ].map((s, i) => (
            <div key={s} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                {i + 1}
              </span>
              <p className="text-sm text-muted-foreground">{s}</p>
            </div>
          ))}
        </div>

        <Button className="w-full" onClick={onClose}>
          <CheckCircle2 className="size-4" /> Done
        </Button>
      </div>
    </Modal>
  );
}

/* ---------------------------- Airport ride card ---------------------------- */

const RIDES = [
  { id: "uberx", name: "UberX", seats: 4, pickup: 6, fare: 61, eta: 42, rating: 4.9 },
  { id: "lyftxl", name: "Lyft XL", seats: 6, pickup: 9, fare: 78, eta: 44, rating: 4.8 },
  { id: "black", name: "Black Car · Private Driver", seats: 3, pickup: 12, fare: 124, eta: 40, rating: 5.0 },
] as const;

export function RideBooking() {
  const { totalMinutes, effectiveDepartureISO, activeTrip } = useAppStore();
  const [ride, setRide] = useState<(typeof RIDES)[number]["id"]>("uberx");
  const [open, setOpen] = useState(false);

  const leaveBy = new Date(effectiveDepartureISO).getTime() - totalMinutes * 60000;
  const leaveByLabel = formatClock(new Date(leaveBy).toISOString());
  const selected = RIDES.find((r) => r.id === ride)!;
  const pickupLabel = formatClock(new Date(leaveBy - selected.pickup * 60000).toISOString());

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-display font-semibold">
            <Car className="size-4 text-primary" /> Book Airport Ride
          </p>
          <p className="text-xs text-muted-foreground">
            Synced to your leave-by time · {leaveByLabel}
          </p>
        </div>
        <Badge tone="accent">Live</Badge>
      </div>

      <p className="flex items-center gap-2 rounded-xl bg-background/50 px-3 py-2 text-xs text-muted-foreground">
        <MapPin className="size-3.5 text-primary" /> Current location → {activeTrip.origin} Terminal{" "}
        {activeTrip.terminal}
      </p>

      <div className="space-y-2">
        {RIDES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRide(r.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
              r.id === ride ? "border-primary bg-primary/10" : "border-border bg-background/40",
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background/60">
              <Car className={cn("size-4", r.id === ride ? "text-primary" : "text-muted-foreground")} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{r.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {r.pickup} min pickup · {r.eta} min to airport · {r.seats} seats
              </p>
            </div>
            <span className="font-display text-lg font-bold text-accent">${r.fare}</span>
          </button>
        ))}
      </div>

      <Button
        className="w-full"
        onClick={() => {
          setOpen(true);
          toast.success("Ride reserved", {
            description: `${selected.name} arrives at ${pickupLabel} for a ${leaveByLabel} departure.`,
          });
        }}
      >
        Confirm &amp; Reserve Ride · ${selected.fare}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Ride confirmed">
        <div className="space-y-4">
          <div className="rounded-2xl border border-success/40 bg-success/10 p-4">
            <p className="flex items-center gap-2 font-display font-bold text-success">
              <BadgeCheck className="size-5" /> Driver on the way
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {selected.name} · arriving {pickupLabel} ({selected.pickup} min)
            </p>
          </div>

          <div className="space-y-2">
            {[
              ["Driver", "Marcus D."],
              ["Vehicle", selected.id === "black" ? "Cadillac XT6 · Black" : "Toyota Camry · Silver"],
              ["Plate", "JIT 4417"],
              ["Rating", `${selected.rating} ★`],
              ["Fare (locked)", `$${selected.fare}`],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between rounded-xl bg-background/50 px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-2xl border border-border bg-background/40 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="size-4 text-primary" /> Leave-by schedule sync
            </p>
            {[
              [`Pickup ${pickupLabel}`, "Driver at your door"],
              [`Depart ${leaveByLabel}`, "Matches your leave-by countdown"],
              [
                `Arrive ${formatClock(new Date(leaveBy + selected.eta * 60000).toISOString())}`,
                `${activeTrip.origin} Terminal ${activeTrip.terminal}`,
              ],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start gap-2">
                <Star className="mt-0.5 size-3 shrink-0 text-accent" />
                <p className="text-xs">
                  <span className="font-semibold">{k}</span>{" "}
                  <span className="text-muted-foreground">· {v}</span>
                </p>
              </div>
            ))}
          </div>

          <Button className="w-full" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

export function TravelServices() {
  return (
    <section data-tour="services" className="space-y-3">
      <p className="font-display font-semibold">Travel services</p>
      <RideBooking />
      <EsimPanel />
    </section>
  );
}
