import { useEffect, useState } from "react";
import { Plane } from "lucide-react";

export const SPLASH_REPLAY_EVENT = "jit:replay-splash";

export function replaySplash() {
  window.dispatchEvent(new Event(SPLASH_REPLAY_EVENT));
}

/** Full-screen branded splash. Holds 2s, then fades out over 0.5s. */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const hold = window.setTimeout(() => setLeaving(true), 2000);
    const exit = window.setTimeout(onDone, 2500);
    return () => {
      window.clearTimeout(hold);
      window.clearTimeout(exit);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="splash-rise flex flex-col items-center gap-5 px-8 text-center">
        <span className="splash-glow relative flex size-20 items-center justify-center rounded-3xl border border-border bg-card">
          <Plane className="size-9 -rotate-45 text-primary" />
        </span>
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Just In Time
          </h1>
          <p className="max-w-xs text-sm text-muted-foreground">
            Your airport assistant that knows exactly when to leave
          </p>
        </div>
      </div>
    </div>
  );
}
