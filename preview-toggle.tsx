import { LogIn, LogOut } from "lucide-react";
import { useAppStore } from "@/lib/app-store";

export const DEMO_EMAIL = "demo@justintime.app";

export function PreviewToggle() {
  const { user, login, logout } = useAppStore();
  const loggedIn = !!user;

  return (
    <button
      onClick={() => (loggedIn ? logout() : login(DEMO_EMAIL))}
      className="fixed bottom-24 right-4 z-50 inline-flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shadow-lg backdrop-blur transition-colors hover:text-foreground"
    >
      {loggedIn ? (
        <LogOut className="size-3.5 text-highlight" />
      ) : (
        <LogIn className="size-3.5 text-primary" />
      )}
      Preview:
      <span className={loggedIn ? "text-highlight" : "text-primary"}>
        {loggedIn ? "Logged in" : "Logged out"}
      </span>
    </button>
  );
}
