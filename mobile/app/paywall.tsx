import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { Badge, Button, Card, Screen, T } from "@/components/ui";
import { config } from "@/lib/config";
import { buyPackage, getProPackages, purchasesAvailable, restorePurchases } from "@/lib/purchases";
import { useApp } from "@/lib/store";
import { colors, fonts, radius } from "@/lib/theme";

const FEATURES = [
  ["notifications-outline", "Live delay, gate change & cancellation alerts"],
  ["infinite-outline", "Unlimited tracked flights"],
  ["refresh-outline", "Flights re-checked every 10 minutes"],
  ["heart-outline", "Support an independent app"],
] as const;

export default function Paywall() {
  const { isPro, setProActive, reload } = useApp();
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);

  useEffect(() => {
    getProPackages()
      .then((p) => {
        setPackages(p);
        const annual = p.find((x) => x.packageType === "ANNUAL") ?? p[0];
        if (annual) setSelected(annual.identifier);
      })
      .catch(() => setPackages([]));
  }, []);

  async function buy() {
    const pkg = packages?.find((p) => p.identifier === selected);
    if (!pkg) return;
    setBusy("buy");
    try {
      const ok = await buyPackage(pkg);
      if (ok) {
        setProActive(true);
        // give the RevenueCat → Supabase webhook a moment, then refresh
        setTimeout(() => reload(), 4000);
        Alert.alert("You're Pro!", "Live flight alerts are now on.");
        router.back();
      }
    } catch (e) {
      Alert.alert("Purchase failed", (e as Error).message ?? "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy("restore");
    try {
      const ok = await restorePurchases();
      setProActive(ok);
      Alert.alert(ok ? "Pro restored" : "Nothing to restore", ok ? "Welcome back!" : "No active subscription found for this Apple ID.");
      if (ok) router.back();
    } catch {
      Alert.alert("Restore failed", "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <Pressable onPress={() => router.back()} accessibilityLabel="Close" style={{ alignSelf: "flex-end" }}>
        <Ionicons name="close" size={26} color={colors.muted} />
      </Pressable>
      <Badge tone="primary">Pro Pass</Badge>
      <T kind="h1">Never miss a gate change again</T>

      <Card>
        {FEATURES.map(([icon, text]) => (
          <View key={text} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Ionicons name={icon} size={20} color={colors.highlight} />
            <T style={{ flex: 1 }}>{text}</T>
          </View>
        ))}
      </Card>

      {isPro ? (
        <Card>
          <T kind="h3" color={colors.highlight}>You're already Pro ★</T>
          <T kind="caption">Thanks for supporting Just In Time.</T>
        </Card>
      ) : packages === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : !purchasesAvailable() || packages.length === 0 ? (
        <T kind="caption">Subscriptions aren't available right now. Please try again later.</T>
      ) : (
        <>
          {packages.map((p) => {
            const active = p.identifier === selected;
            const annual = p.packageType === "ANNUAL";
            return (
              <Pressable
                key={p.identifier}
                onPress={() => setSelected(p.identifier)}
                style={{
                  borderWidth: 1.5,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primary + "14" : colors.card,
                  borderRadius: radius.lg,
                  padding: 16,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <T style={{ fontFamily: fonts.bodySemi }}>{annual ? "Annual Travel Pass" : "Monthly Access"}</T>
                  <T kind="caption">
                    {annual && p.product.pricePerMonthString
                      ? `Just ${p.product.pricePerMonthString}/month`
                      : "Cancel anytime"}
                  </T>
                </View>
                <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.primary }}>
                  {p.product.priceString}
                  <Text style={{ fontSize: 13, color: colors.muted }}>{annual ? "/yr" : "/mo"}</Text>
                </Text>
              </Pressable>
            );
          })}
          <Button title="Continue" onPress={buy} loading={busy === "buy"} disabled={!selected} />
        </>
      )}

      <Pressable onPress={restore} disabled={busy === "restore"} style={{ alignSelf: "center" }}>
        <T kind="caption" color={colors.primary}>{busy === "restore" ? "Restoring…" : "Restore purchases"}</T>
      </Pressable>

      <T kind="caption" style={{ fontSize: 11, textAlign: "center" }}>
        Payment is charged to your Apple ID at confirmation. Subscriptions renew automatically unless
        cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in
        your App Store account settings.
      </T>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 18 }}>
        <Pressable onPress={() => WebBrowser.openBrowserAsync(config.termsUrl)}>
          <T kind="caption" color={colors.primary}>Terms of Use</T>
        </Pressable>
        {config.privacyUrl ? (
          <Pressable onPress={() => WebBrowser.openBrowserAsync(config.privacyUrl)}>
            <T kind="caption" color={colors.primary}>Privacy Policy</T>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}
