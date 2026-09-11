import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Crown, GraduationCap, LocateFixed, LogOut, Mail, MapPin, Phone, Sparkles, TimerReset } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { LockScreenPreview, LockScreenPreviewButton } from "@/components/lock-screen-preview";
import { ProModal } from "@/components/pro-modal";
import { RecentAlerts } from "@/components/recent-alerts";
import { replaySplash } from "@/components/splash-screen";
import { Badge, Button, Card, Field, Modal } from "@/components/ui-kit";
import { useAppStore } from "@/lib/app-store";
import { CalendarSync } from "@/components/trip-management";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile & Pro Pass — Just In Time" },
      {
        name: "description",
        content:
          "Manage your traveler details, travel history, Pro Pass subscription and password settings.",
      },
      { property: "og:title", content: "Profile & Pro Pass — Just In Time" },
      {
        property: "og:description",
        content: "Traveler details, travel history, subscription status and password settings.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <AppShell>
      <Profile />
    </AppShell>
  );
}

function Profile() {
  const { user, pro, plan, logout, cancelPro, history, milestones, replayOnboarding } =
    useAppStore();
  const [proOpen, setProOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const stamped = milestones.filter((m) => m.stampedAt).length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">Account, history and subscription</p>
      </header>

      <Card className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 font-display text-xl font-bold text-primary">
            {(user?.email ?? "T").slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold">
              {user?.email.split("@")[0] ?? "Traveler"}
            </p>
            <Badge tone={pro ? "success" : "muted"}>
              <Crown className="size-3" />
              {pro
                ? `Pro member · ${plan === "annual" ? "Annual" : "Monthly"}`
                : "Free plan"}
            </Badge>
          </div>
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="size-4" /> {user?.email}
        </p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="size-4" /> {user?.phone}
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        {[
          ["Trips", String(history.length + 1)],
          ["Stamps", String(stamped)],
          ["Airports", "6"],
        ].map(([k, v]) => (
          <Card key={k} className="p-4 text-center">
            <p className="font-display text-2xl font-bold text-primary">{v}</p>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{k}</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-3">
        <p className="font-display font-semibold">Subscription</p>
        <p className="text-sm text-muted-foreground">
          {pro
            ? "Pro Pass is active — live TSA alerts, door-to-gate sync and no ads."
            : "You're on the free plan. Upgrade for live TSA alerts and zero ads."}
        </p>
        <Button className="w-full" onClick={() => setProOpen(true)}>
          {pro ? "Manage Pro Pass" : "Upgrade to Pro Pass"}
        </Button>
        {pro && (
          <Button variant="ghost" size="sm" className="w-full" onClick={cancelPro}>
            Cancel subscription
          </Button>
        )}
      </Card>

      <RecentAlerts />

      <Card>
        <CalendarSync />
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display font-semibold">Dynamic location-based alerts</p>
            <p className="text-xs text-muted-foreground">Preview how timing reacts while you travel.</p>
          </div>
          <LocateFixed className="size-5 text-primary" />
        </div>
        {[
          { Icon: MapPin, title: "Location change detected: Recalculating departure time from current location.", time: "Just now", tag: "Live" },
          { Icon: TimerReset, title: "Traffic update: Leave by 10:15 AM to reach Terminal B on time.", time: "10:02 AM", tag: "Priority" },
        ].map(({ Icon, title, time, tag }) => (
          <div key={title} className="flex items-start gap-3 rounded-xl bg-background/40 p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15"><Icon className="size-4 text-primary" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">{time}</p>
            </div>
            <Badge tone={tag === "Priority" ? "warning" : "primary"}>{tag}</Badge>
          </div>
        ))}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            toast("Location change detected", { description: "Recalculating departure time from your current location." });
            window.setTimeout(() => toast.warning("Traffic update", { description: "Leave by 10:15 AM to reach Terminal B on time." }), 450);
          }}
        >
          <LocateFixed className="size-4" /> Simulate location shift
        </Button>
        <LockScreenPreviewButton onOpen={() => setLockOpen(true)} />
      </Card>

      <Card className="space-y-3">
        <p className="font-display font-semibold">Travel history</p>
        {history.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-xl bg-background/40 p-3">
            <div>
              <p className="font-semibold">{t.route}</p>
              <p className="text-xs text-muted-foreground">
                {t.flight} · {t.date}
              </p>
            </div>
            <Badge tone="muted">Logged</Badge>
          </div>
        ))}
      </Card>

      <Card className="space-y-3">
        <p className="font-display font-semibold">Security</p>
        <Button variant="outline" className="w-full" onClick={() => setPwOpen(true)}>
          Change password
        </Button>
        <Button variant="outline" className="w-full" onClick={replayOnboarding}>
          <GraduationCap className="size-4" /> Replay interactive tour
        </Button>
        <Button variant="ghost" className="w-full" onClick={replaySplash}>
          <Sparkles className="size-4" /> Replay intro animation
        </Button>
        <Button variant="ghost" className="w-full" onClick={logout}>
          <LogOut className="size-4" /> Log out / switch user
        </Button>
      </Card>

      <ProModal open={proOpen} onClose={() => setProOpen(false)} />
      <LockScreenPreview open={lockOpen} onClose={() => setLockOpen(false)} />

      <Modal
        open={pwOpen}
        onClose={() => {
          setPwOpen(false);
          setPwMsg("");
        }}
        title="Change password"
      >
        <div className="space-y-3">
          <Field
            label="Current password"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <Field
            label="New password"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          {pwMsg && (
            <p
              className={`text-xs font-semibold ${
                pwMsg.startsWith("Password") ? "text-success" : "text-destructive"
              }`}
            >
              {pwMsg}
            </p>
          )}
          <Button
            className="w-full"
            onClick={() => {
              if (current.length < 4 || next.length < 6) {
                setPwMsg("Enter your current password and a new one with 6+ characters.");
                return;
              }
              setPwMsg("Password updated successfully.");
              setCurrent("");
              setNext("");
            }}
          >
            Update password
          </Button>
        </div>
      </Modal>
    </div>
  );
}
