import { useState } from "react";
import { Check, Crown, Sparkles } from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui-kit";
import { useAppStore, type Plan } from "@/lib/app-store";

const FEATURES = [
  "Real-time TSA queue alerts",
  "Automated door-to-gate sync",
  "Zero ads, ever",
  "Priority airport transfers",
];

export function ProModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { subscribe, restore, pro, plan } = useAppStore();
  const [selected, setSelected] = useState<Plan>("annual");
  const [confirm, setConfirm] = useState<null | "subscribed" | "restored">(null);

  const plans: { id: Plan; name: string; price: string; note: string }[] = [
    { id: "monthly", name: "Monthly Access", price: "$4.99/mo", note: "Cancel anytime" },
    { id: "annual", name: "Annual Travel Pass", price: "$39.99/yr", note: "Just $3.33 per month" },
  ];

  return (
    <>
      <Modal open={open && !confirm} onClose={onClose} title="Just In Time Pro Pass">
        <p className="text-sm text-muted-foreground">
          Never guess your leave-by time again. Pro unlocks live airport intelligence.
        </p>

        <div className="mt-5 space-y-3">
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`w-full rounded-2xl border p-4 text-left transition-all ${
                selected === p.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background/40 hover:border-muted-foreground/40"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display font-bold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.note}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold text-primary">{p.price}</p>
                  {p.id === "annual" && (
                    <Badge tone="success" className="mt-1">
                      Best value · save 33%
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <ul className="mt-5 space-y-2">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm">
              <Check className="size-4 text-success" />
              {f}
            </li>
          ))}
        </ul>

        <div className="mt-6 space-y-2">
          <Button
            className="w-full"
            onClick={() => {
              subscribe(selected);
              setConfirm("subscribed");
            }}
          >
            <Sparkles className="size-4" />
            {pro ? "Switch plan" : "Subscribe now"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              restore();
              setConfirm("restored");
            }}
          >
            Restore purchases
          </Button>
        </div>
        {pro && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Current plan: {plan === "annual" ? "Annual Travel Pass" : "Monthly Access"}
          </p>
        )}
      </Modal>

      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-background/90 p-4 backdrop-blur-sm">
          <Confetti />
          <div className="relative w-full max-w-sm animate-[scale-in_0.25s_ease-out] rounded-3xl border border-primary/40 bg-card p-6 text-center shadow-[0_30px_90px_-30px_rgba(6,182,212,0.55)]">
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/15">
              <Crown className="size-8 text-primary" />
            </span>
            <h2 className="mt-4 font-display text-2xl font-bold">
              {confirm === "restored" ? "Purchases restored" : "Pro Pass activated"}
            </h2>
            <Badge tone="success" className="mt-2">
              Pro member
            </Badge>
            <p className="mt-3 text-sm text-muted-foreground">
              {confirm === "restored"
                ? "We found an active Pro Pass on this account and re-activated it."
                : `Your ${selected === "annual" ? "Annual Travel Pass" : "Monthly Access"} is live.`}
            </p>
            <ul className="mt-4 space-y-2 rounded-2xl bg-background/50 p-4 text-left">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="size-4 shrink-0 text-success" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className="mt-5 w-full"
              onClick={() => {
                setConfirm(null);
                onClose();
              }}
            >
              Back to my flight
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

const CONFETTI_COLORS = [
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-success)",
  "var(--color-warning)",
];

function Confetti() {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: (i % 10) * 0.12,
    drift: ((i % 7) - 3) * 24,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  }));
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            ["--drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
