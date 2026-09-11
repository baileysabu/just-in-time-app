import { Bell, Car, DoorOpen, Luggage, ShieldCheck } from "lucide-react";
import { Badge, Card } from "@/components/ui-kit";

const ALERTS = [
  {
    id: "leave",
    Icon: Car,
    title: "Leave by 10:15 AM to beat traffic",
    time: "Today · 9:42 AM",
    tone: "primary" as const,
    tag: "Action",
  },
  {
    id: "tsa",
    Icon: ShieldCheck,
    title: "Security queue: 8 min wait at JFK T4",
    time: "Today · 9:31 AM",
    tone: "success" as const,
    tag: "Live",
  },
  {
    id: "gate",
    Icon: DoorOpen,
    title: "Gate changed to C4",
    time: "Today · 9:05 AM",
    tone: "warning" as const,
    tag: "Update",
  },
  {
    id: "bag",
    Icon: Luggage,
    title: "Baggage carousel assigned: Carousel 3",
    time: "Yesterday · 6:18 PM",
    tone: "muted" as const,
    tag: "Arrival",
  },
];

export function RecentAlerts() {
  return (
    <Card className="space-y-3">
      <p className="flex items-center gap-2 font-display font-semibold">
        <Bell className="size-4 text-primary" /> Recent alerts
      </p>
      {ALERTS.map(({ id, Icon, title, time, tone, tag }) => (
        <div key={id} className="flex items-start gap-3 rounded-xl bg-background/40 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
            <Icon className="size-4 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{time}</p>
          </div>
          <Badge tone={tone}>{tag}</Badge>
        </div>
      ))}
    </Card>
  );
}
