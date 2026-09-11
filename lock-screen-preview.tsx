import { useState } from "react";
import {
  Battery,
  Camera,
  SignalHigh,
  ChevronDown,
  Flashlight,
  Lock,
  Plane,
  Smartphone,
  Wifi,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui-kit";
import { cn } from "@/lib/utils";

interface PreviewNotification {
  id: string;
  time: string;
  body: string;
  detail?: string;
}

const NOTIFICATIONS: PreviewNotification[] = [
  {
    id: "sync",
    time: "10m ago",
    body: "Sync Complete: Flight AA 1042 added from Apple Calendar.",
    detail: "Imported departure date, terminal and gate. Your leave-by time is now pinned to this flight.",
  },
  {
    id: "location",
    time: "Now",
    body: "Location Update: Departing from current location? Recommended leave time updated to 10:15 AM.",
    detail: "Traffic on your usual route is heavier than normal. Just In Time recalculated automatically.",
  },
];

function AppIcon() {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/20 ring-1 ring-primary/40">
      <Plane className="size-4 text-primary" />
    </span>
  );
}

function NotificationCard({ notification }: { notification: PreviewNotification }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className={cn(
        "w-full rounded-2xl border border-white/15 bg-white/10 p-3 text-left shadow-lg backdrop-blur-xl transition-all duration-300",
        "hover:bg-white/15 active:scale-[0.98]",
        expanded && "border-primary/40 bg-white/15 ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-center gap-2">
        <AppIcon />
        <p className="flex-1 truncate text-xs font-semibold text-white/90">
          Just In Time <span className="font-normal text-white/50">• {notification.time}</span>
        </p>
        <ChevronDown
          className={cn(
            "size-3.5 text-white/50 transition-transform duration-300",
            expanded && "rotate-180",
          )}
        />
      </div>
      <p className="mt-2 text-sm leading-snug text-white">{notification.body}</p>
      {expanded && notification.detail && (
        <p className="mt-2 animate-fade-in border-t border-white/10 pt-2 text-xs leading-relaxed text-white/60">
          {notification.detail}
        </p>
      )}
    </button>
  );
}

export function LockScreenPreview({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Lock Screen Preview">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          How Just In Time push notifications appear on a smartphone lock screen. Tap a
          notification to expand it.
        </p>

        {/* Phone frame */}
        <div className="mx-auto w-full max-w-[300px] rounded-[2.75rem] border-2 border-border bg-black p-2 shadow-2xl shadow-primary/10">
          <div
            className="relative flex h-[540px] flex-col overflow-hidden rounded-[2.25rem]"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 0%, #1b3a4a 0%, #101c26 45%, #0a0f14 100%)",
            }}
          >
            {/* Atmospheric depth blobs */}
            <div className="pointer-events-none absolute -top-10 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
            <div className="pointer-events-none absolute bottom-16 -right-10 h-48 w-48 rounded-full bg-highlight/10 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 bg-black/20 backdrop-blur-[1px]" />

            {/* Notch */}
            <div className="absolute left-1/2 top-2 z-20 h-6 w-28 -translate-x-1/2 rounded-full bg-black" />

            {/* Status bar */}
            <div className="relative z-10 flex items-center justify-between px-6 pt-3 text-white">
              <span className="text-[11px] font-semibold">9:41</span>
              <div className="flex items-center gap-1.5">
                <SignalHigh className="size-3.5" />
                <Wifi className="size-3.5" />
                <Battery className="size-4" />
              </div>
            </div>

            {/* Lock + clock */}
            <div className="relative z-10 mt-6 flex flex-col items-center text-white">
              <Lock className="size-4 text-white/80" />
              <p className="text-glow-blue mt-3 font-display text-6xl font-bold tracking-tight">
                10:04
              </p>
              <p className="mt-1 text-xs font-medium text-white/70">
                Friday, September 11
              </p>
            </div>

            {/* Notifications */}
            <div className="relative z-10 mt-6 flex-1 space-y-2 overflow-y-auto px-3">
              {NOTIFICATIONS.map((n) => (
                <NotificationCard key={n.id} notification={n} />
              ))}
            </div>

            {/* Quick-launch shortcuts */}
            <div className="relative z-10 flex items-center justify-between px-8 pb-2 pt-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
                <Flashlight className="size-5 text-white" />
              </span>
              <span className="flex size-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
                <Camera className="size-5 text-white" />
              </span>
            </div>

            {/* Home indicator */}
            <div className="relative z-10 flex justify-center pb-2">
              <span className="h-1 w-28 rounded-full bg-white/70" />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-elevated"
        >
          <X className="size-4" /> Close preview
        </button>
      </div>
    </Modal>
  );
}

export function LockScreenPreviewButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-all hover:bg-primary/20 hover:shadow-[0_0_20px_color-mix(in_srgb,var(--color-primary)_25%,transparent)]"
    >
      <Smartphone className="size-4" /> Lock Screen Preview
    </button>
  );
}
