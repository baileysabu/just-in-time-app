import { Link } from "@tanstack/react-router";
import { Home, Map, Plane, Plus, User } from "lucide-react";
import { useAppStore } from "@/lib/app-store";
import { openNewTrip } from "@/components/trip-management";

const tabs = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/map", label: "Map", Icon: Map },
  { to: "/trips", label: "Trips", Icon: Plane },
  { to: "/profile", label: "Profile", Icon: User },
] as const;

export function BottomNav() {
  const { pro } = useAppStore();
  return (
    <nav className="sticky bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 py-2">
        {tabs.slice(0, 2).map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            data-tour={to === "/map" ? "map" : undefined}
            activeOptions={{ exact: to === "/" }}
            activeProps={{ className: "text-primary" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className="relative flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold uppercase transition-colors"
          >
            <Icon className="size-5" />
            {label}
            {pro && to === "/profile" && (
              <span className="absolute -top-0.5 right-1/2 translate-x-8 rounded-full bg-success px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-success-foreground">
                Pro
              </span>
            )}
          </Link>
        ))}
        <button onClick={openNewTrip} aria-label="Add new trip" className="flex flex-col items-center gap-1 text-[10px] font-semibold uppercase text-primary">
          <span className="-mt-6 flex size-12 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-[0_0_22px_color-mix(in_srgb,var(--color-primary)_35%,transparent)]">
            <Plus className="size-5" />
          </span>
          New trip
        </button>
        {tabs.slice(2).map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: false }}
            activeProps={{ className: "text-primary" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className="relative flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold uppercase transition-colors"
          >
            <Icon className="size-5" />
            {label}
            {pro && to === "/profile" && <span className="absolute -top-0.5 right-1/2 translate-x-8 rounded-full bg-success px-1.5 py-0.5 text-[8px] font-bold uppercase text-success-foreground">Pro</span>}
          </Link>
        ))}
      </div>
    </nav>
  );
}
