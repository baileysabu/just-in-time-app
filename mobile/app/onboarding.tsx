import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useState } from "react";
import { View } from "react-native";
import { Button, Card, Screen, T, ToggleRow } from "@/components/ui";
import { updateProfile } from "@/lib/api";
import { ensureNotificationPermission, registerForPush } from "@/lib/notifications";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

const STEPS = [
  {
    icon: "timer-outline" as const,
    title: "Know exactly when to leave",
    body: "Add your flight and we count down to the moment you need to walk out the door — drive, security, walk to the gate and boarding included.",
  },
  {
    icon: "notifications-outline" as const,
    title: "Get a nudge when it's time",
    body: "We'll remind you 30 minutes before you should leave, and again when it's time to go. Pro members also get live delay and gate-change alerts.",
  },
  {
    icon: "car-outline" as const,
    title: "Live traffic to the airport",
    body: "Share your location and we'll use real traffic to calculate your drive — only while you're using the app.",
  },
];

export default function Onboarding() {
  const { session, profile, setProfile } = useApp();
  const [step, setStep] = useState(0);
  const [precheck, setPrecheck] = useState(profile?.precheck ?? false);
  const [bag, setBag] = useState(profile?.checking_bag ?? false);
  const [saving, setSaving] = useState(false);
  const userId = session?.user.id;

  async function next() {
    if (step === 1) {
      if (await ensureNotificationPermission(true)) registerForPush();
    }
    if (step === 2) {
      await Location.requestForegroundPermissionsAsync().catch(() => {});
    }
    setStep((s) => s + 1);
  }

  async function finish() {
    if (!userId) return;
    setSaving(true);
    try {
      await updateProfile(userId, { precheck, checking_bag: bag, onboarded: true });
      setProfile({ precheck, checking_bag: bag, onboarded: true });
    } catch {
      setSaving(false);
    }
  }

  if (step < STEPS.length) {
    const s = STEPS[step];
    return (
      <Screen scroll={false} edges={["top", "bottom"]}>
        <View style={{ flex: 1, justifyContent: "center", gap: 18 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.primary + "22",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={s.icon} size={34} color={colors.primary} />
          </View>
          <T kind="h1">{s.title}</T>
          <T kind="caption" style={{ fontSize: 16, lineHeight: 23 }}>{s.body}</T>
        </View>
        <View style={{ flexDirection: "row", gap: 6, justifyContent: "center", marginBottom: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                width: i === step ? 22 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === step ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>
        <Button
          title={step === 1 ? "Allow notifications" : step === 2 ? "Allow location" : "Next"}
          onPress={next}
        />
        {step > 0 ? <Button title="Not now" variant="ghost" onPress={() => setStep((x) => x + 1)} /> : null}
      </Screen>
    );
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={{ marginTop: 32, gap: 8 }}>
        <T kind="h1">Your airport habits</T>
        <T kind="caption">These make your security time estimate more accurate. Change them anytime in Profile.</T>
      </View>
      <Card>
        <ToggleRow
          title="TSA PreCheck"
          subtitle="Shorter security lines"
          value={precheck}
          onChange={setPrecheck}
        />
        <ToggleRow
          title="I usually check a bag"
          subtitle="Adds time for bag drop"
          value={bag}
          onChange={setBag}
        />
      </Card>
      <Button title="Start using Just In Time" onPress={finish} loading={saving} />
    </Screen>
  );
}
