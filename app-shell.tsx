import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AuthFlow } from "@/components/auth-flow";
import { BottomNav } from "@/components/bottom-nav";
import { PreviewToggle } from "@/components/preview-toggle";
import { SplashScreen, SPLASH_REPLAY_EVENT } from "@/components/splash-screen";
import { AddFlightModal, NEW_TRIP_EVENT } from "@/components/trip-management";
import { OnboardingTour } from "@/components/onboarding-tour";
import { useAppStore } from "@/lib/app-store";

let splashShown = false;
let forcedSignOut = false;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, hydrated, logout, onboarded, completeOnboarding } = useAppStore();
  const [splash, setSplash] = useState(!splashShown);
  const [addFlightOpen, setAddFlightOpen] = useState(false);

  const finishSplash = useCallback(() => {
    splashShown = true;
    setSplash(false);
  }, []);

  useEffect(() => {
    const replay = () => setSplash(true);
    window.addEventListener(SPLASH_REPLAY_EVENT, replay);
    return () => window.removeEventListener(SPLASH_REPLAY_EVENT, replay);
  }, []);

  useEffect(() => {
    const open = () => setAddFlightOpen(true);
    window.addEventListener(NEW_TRIP_EVENT, open);
    return () => window.removeEventListener(NEW_TRIP_EVENT, open);
  }, []);

  // Every fresh page load starts at the Welcome / Sign in flow.
  useEffect(() => {
    if (hydrated && !forcedSignOut) {
      forcedSignOut = true;
      logout();
    }
  }, [hydrated, logout]);

  const showSplash = splash || !hydrated;

  return (
    <>
      {showSplash && <SplashScreen key={String(splash)} onDone={finishSplash} />}
      {!showSplash &&
        (user ? (
          <div className="flex min-h-screen flex-col animate-fade-in">
            <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-8 pt-6">{children}</main>
            <BottomNav />
            <AddFlightModal open={addFlightOpen} onClose={() => setAddFlightOpen(false)} />
            <OnboardingTour open={!onboarded} onClose={completeOnboarding} />
          </div>
        ) : (
          <div className="animate-fade-in">
            <AuthFlow />
          </div>
        ))}
      {!showSplash && <PreviewToggle />}
    </>
  );
}
