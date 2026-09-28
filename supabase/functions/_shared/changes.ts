import type { FlightInfo } from "./aerodatabox.ts";

export type Change = { kind: "delay" | "gate" | "cancel" | "status"; message: string };

type Before = {
  flight_number: string;
  status: string;
  gate: string | null;
  estimated_departure: string;
};

function clock(iso: string, tz: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz ?? "UTC",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(11, 16) + " UTC";
  }
}

/** Compares stored trip vs fresh provider data and describes what changed. */
export function detectChanges(before: Before, after: FlightInfo): Change[] {
  const changes: Change[] = [];
  const name = before.flight_number.replace(/^([A-Z0-9]{2})(\d+)$/, "$1 $2");

  if (after.status === "Canceled" && before.status !== "Canceled") {
    changes.push({ kind: "cancel", message: `${name} has been canceled. Check your airline app to rebook.` });
    return changes;
  }

  const shift = Math.round(
    (Date.parse(after.estimatedDeparture) - Date.parse(before.estimated_departure)) / 60000,
  );
  if (Math.abs(shift) >= 10) {
    const when = clock(after.estimatedDeparture, after.originTimeZone);
    changes.push({
      kind: "delay",
      message:
        shift > 0
          ? `${name} delayed ${shift} min — now departs ${when}. Your leave-by time moved later.`
          : `${name} now departs ${Math.abs(shift)} min earlier (${when}). Leave sooner!`,
    });
  }

  if (after.gate && before.gate && after.gate !== before.gate) {
    changes.push({ kind: "gate", message: `Gate change for ${name}: ${before.gate} → ${after.gate}` });
  } else if (after.gate && !before.gate) {
    changes.push({ kind: "gate", message: `Gate assigned for ${name}: ${after.gate}` });
  }

  if (after.status === "Boarding" && before.status !== "Boarding") {
    changes.push({ kind: "status", message: `${name} is now boarding${after.gate ? ` at gate ${after.gate}` : ""}.` });
  }
  return changes;
}
