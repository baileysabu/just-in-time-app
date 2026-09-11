import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { ArrowDown, ArrowUp, CalendarCheck, Globe2, Map, TimerReset } from "lucide-react";
import { Button } from "@/components/ui-kit";
import { cn } from "@/lib/utils";

type Step = {
  id: string;
  target: string;
  title: string;
  body: string;
  Icon: typeof Map;
};

const STEPS: Step[] = [
  {
    id: "sync",
    target: '[data-tour="sync"]',
    title: "Auto-Import Flights",
    body: "Add a trip manually or connect Google & Apple Calendar — your flights import themselves.",
    Icon: CalendarCheck,
  },
  {
    id: "leaveby",
    target: '[data-tour="leaveby"]',
    title: "Dynamic Location Alerts",
    body: "Live traffic and your real-time location keep this leave-by countdown accurate to the minute.",
    Icon: TimerReset,
  },
  {
    id: "map",
    target: '[data-tour="map"]',
    title: "Indoor Gate Navigation",
    body: "Turn-by-turn walking directions inside the terminal, straight to your departure gate.",
    Icon: Map,
  },
  {
    id: "services",
    target: '[data-tour="services"]',
    title: "Travel Services",
    body: "Book eSIMs and airport transfers instantly — synced to your leave-by time.",
    Icon: Globe2,
  },
];

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;

export function OnboardingTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = STEPS[Math.min(index, STEPS.length - 1)]!;

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const measure = useCallback(() => {
    if (!open) return;
    const el = document.querySelector(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [open, step.target]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = document.querySelector(step.target);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    measure();
    const id = window.setInterval(measure, 250);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step.target, measure]);

  if (!open) return null;

  const last = index === STEPS.length - 1;
  const below = rect ? rect.top + rect.height < window.innerHeight * 0.55 : true;
  const cardStyle = rect
    ? below
      ? { top: Math.min(rect.top + rect.height + 14, window.innerHeight - 260) }
      : { bottom: Math.min(window.innerHeight - rect.top + 14, window.innerHeight - 200) }
    : { top: "20%" as const };

  return (
    <div className="fixed inset-0 z-[80]">
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-2xl border-2 border-primary transition-all duration-300"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow:
              "0 0 0 9999px color-mix(in srgb, var(--color-background) 88%, transparent), 0 0 26px color-mix(in srgb, var(--color-primary) 70%, transparent)",
          }}
        >
          <span className="absolute inset-0 animate-pulse rounded-2xl border border-primary/60" />
          <span
            className={cn(
              "absolute left-1/2 -translate-x-1/2 text-primary",
              below ? "-bottom-8" : "-top-8",
            )}
          >
            {below ? <ArrowDown className="size-6 animate-bounce" /> : <ArrowUp className="size-6 animate-bounce" />}
          </span>
        </div>
      ) : (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" />
      )}

      <div
        className="absolute left-1/2 w-[min(92vw,26rem)] -translate-x-1/2 rounded-3xl border border-border bg-card/95 p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <step.Icon className="size-5" />
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-accent">
              Step {index + 1} of {STEPS.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Skip tour
            </button>
          </div>
        </div>

        <h2 className="mt-3 font-display text-xl font-bold">{step.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>

        <div className="mt-4 flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Go to step ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === index ? "w-6 bg-accent" : "w-2 bg-muted hover:bg-primary/60",
              )}
            />
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          {index > 0 && (
            <Button variant="outline" className="flex-1" onClick={() => setIndex((i) => i - 1)}>
              Back
            </Button>
          )}
          <Button
            className="flex-1"
            variant={last ? "accent" : "primary"}
            onClick={() => (last ? onClose() : setIndex((i) => i + 1))}
          >
            {last ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
