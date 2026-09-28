/** "3:25 PM" in the given time zone (airport local time), or device time. */
export function formatClock(iso: string | Date, timeZone?: string | null): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  try {
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      ...(timeZone ? { timeZone } : {}),
    });
  } catch {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
}

/** "Sat, Oct 3" */
export function formatDay(iso: string | Date, timeZone?: string | null): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  try {
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      ...(timeZone ? { timeZone } : {}),
    });
  } catch {
    return d.toDateString();
  }
}

export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
