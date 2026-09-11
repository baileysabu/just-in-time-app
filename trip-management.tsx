import { useState } from "react";
import { CalendarCheck, CalendarDays, Check, Circle, Plane, Plus, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Field, Modal } from "@/components/ui-kit";
import {
  formatClock,
  useAppStore,
  type CalendarProvider,
  type Milestone,
  type Trip,
} from "@/lib/app-store";
import { cn } from "@/lib/utils";

export const NEW_TRIP_EVENT = "jit:new-trip";

export function openNewTrip() {
  window.dispatchEvent(new Event(NEW_TRIP_EVENT));
}

export function TripSelector({ className }: { className?: string }) {
  const { trips, activeTripId, selectTrip } = useAppStore();
  return (
    <div className={cn("-mx-5 overflow-x-auto px-5 pb-1", className)}>
      <div className="flex min-w-max gap-2">
        {trips.map((trip) => {
          const active = trip.id === activeTripId;
          return (
            <button
              key={trip.id}
              onClick={() => selectTrip(trip.id)}
              className={cn(
                "min-w-36 rounded-xl border px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <span className={cn("block text-xs font-bold", active && "text-primary")}>{trip.flight}</span>
              <span className="mt-0.5 block text-sm font-semibold text-foreground">
                {trip.origin} → {trip.destination}
              </span>
              <span className="mt-0.5 block text-[10px] uppercase text-muted-foreground">
                {new Date(trip.departureISO).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                {" · "}{formatClock(trip.departureISO)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MilestoneTracker({ compact = false }: { compact?: boolean }) {
  const { milestones, stamp } = useAppStore();
  const completed = milestones.filter((milestone) => milestone.stampedAt).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display font-semibold">Milestones</p>
        <Badge tone={completed === milestones.length ? "success" : "muted"}>
          {completed}/{milestones.length} complete
        </Badge>
      </div>
      <div className={compact ? "grid grid-cols-4 gap-1.5" : "space-y-2"}>
        {milestones.map((milestone) => (
          <MilestoneButton key={milestone.id} milestone={milestone} compact={compact} onStamp={stamp} />
        ))}
      </div>
    </div>
  );
}

function MilestoneButton({
  milestone,
  compact,
  onStamp,
}: {
  milestone: Milestone;
  compact: boolean;
  onStamp: (id: string) => void;
}) {
  const complete = Boolean(milestone.stampedAt);
  return (
    <button
      onClick={() => onStamp(milestone.id)}
      disabled={complete}
      className={cn(
        "border transition-colors",
        compact
          ? "flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-center"
          : "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left",
        complete ? "border-highlight/40 bg-highlight/10" : "border-border bg-background/40 hover:border-primary",
      )}
    >
      {complete ? <Check className="size-4 shrink-0 text-highlight" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
      <span className={cn("font-semibold", compact ? "text-[10px] leading-tight" : "flex-1 text-sm")}>{milestone.label}</span>
      {!compact && <span className="text-xs text-muted-foreground">{complete && milestone.stampedAt ? formatClock(milestone.stampedAt) : "Tap to complete"}</span>}
    </button>
  );
}

export function CalendarSync() {
  const { calendarSync, toggleCalendar } = useAppStore();
  const imported = calendarSync.google.imported + calendarSync.apple.imported;
  const active = calendarSync.google.connected || calendarSync.apple.connected;

  return (
    <div className="space-y-3">
      <div>
        <p className="font-display font-semibold">Sync calendar</p>
        <p className="text-xs text-muted-foreground">Import flight details automatically.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CalendarButton provider="google" label="Google Calendar" connected={calendarSync.google.connected} onToggle={toggleCalendar} />
        <CalendarButton provider="apple" label="Apple Calendar" connected={calendarSync.apple.connected} onToggle={toggleCalendar} />
      </div>
      {active && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-3">
          <p className="flex items-start gap-2 text-xs font-semibold text-primary">
            <CalendarCheck className="mt-0.5 size-4 shrink-0" />
            Auto-sync active: Flight details automatically imported from Google & Apple Calendar.
          </p>
          <p className="mt-1 pl-6 text-[11px] text-muted-foreground">{imported} flights imported in this preview.</p>
        </div>
      )}
    </div>
  );
}

function CalendarButton({
  provider,
  label,
  connected,
  onToggle,
}: {
  provider: CalendarProvider;
  label: string;
  connected: boolean;
  onToggle: (provider: CalendarProvider) => void;
}) {
  const Icon = provider === "google" ? CalendarDays : Smartphone;
  return (
    <Button
      type="button"
      variant="outline"
      className={cn("h-auto min-h-16 flex-col px-2", connected && "border-primary bg-primary/10 text-primary")}
      onClick={() => {
        onToggle(provider);
        toast.success(connected ? `${label} disconnected` : `${label} sync active`);
      }}
    >
      <Icon className="size-5" />
      <span>{connected ? "Synced" : label}</span>
    </Button>
  );
}

export function AddFlightModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addTrip } = useAppStore();
  const [airline, setAirline] = useState("American Airlines");
  const [flight, setFlight] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departure, setDeparture] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const normalizedFlight = flight.trim().toUpperCase();
    const from = origin.trim().toUpperCase();
    const to = destination.trim().toUpperCase();
    const departureDate = new Date(departure);
    if (!normalizedFlight || from.length !== 3 || to.length !== 3 || Number.isNaN(departureDate.getTime())) {
      setError("Add a flight number, date and valid 3-letter airport codes.");
      return;
    }
    addTrip({ airline, flight: normalizedFlight, origin: from, destination: to, departureISO: departureDate.toISOString() });
    toast.success(`${normalizedFlight} added`, { description: `${from} to ${to} is now your active trip.` });
    setFlight("");
    setOrigin("");
    setDestination("");
    setDeparture("");
    setError("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Flight">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Airline</span>
          <select value={airline} onChange={(event) => setAirline(event.target.value)} className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm outline-none focus:border-primary">
            <option>American Airlines</option>
            <option>Delta Air Lines</option>
            <option>United Airlines</option>
            <option>JetBlue</option>
          </select>
        </label>
        <Field label="Flight number" placeholder="AA 1042" value={flight} onChange={(event) => setFlight(event.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Origin" placeholder="JFK" maxLength={3} value={origin} onChange={(event) => setOrigin(event.target.value)} />
          <Field label="Destination" placeholder="LAX" maxLength={3} value={destination} onChange={(event) => setDestination(event.target.value)} />
        </div>
        <Field label="Departure date & time" type="datetime-local" value={departure} onChange={(event) => setDeparture(event.target.value)} />
        {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
        <Button className="w-full" onClick={submit}><Plane className="size-4" /> Add flight</Button>
        <div className="border-t border-border pt-4"><CalendarSync /></div>
      </div>
    </Modal>
  );
}

export function NewTripButton({ label = false }: { label?: boolean }) {
  return (
    <Button size="sm" aria-label="Add new trip" onClick={openNewTrip} className={label ? undefined : "size-10 rounded-full p-0"}>
      <Plus className="size-4" /> {label && "New trip"}
    </Button>
  );
}

export function tripRoute(trip: Trip) {
  return `${trip.origin} → ${trip.destination}`;
}