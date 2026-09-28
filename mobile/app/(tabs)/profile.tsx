import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Badge, Button, Card, Screen, T, ToggleRow } from "@/components/ui";
import { deleteAccount, updateProfile } from "@/lib/api";
import { config } from "@/lib/config";
import { timeAgo } from "@/lib/format";
import { restorePurchases } from "@/lib/purchases";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

export default function Profile() {
  const { session, profile, setProfile, isPro, setProActive, alerts, signOut } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const userId = session?.user.id;

  function setPref(key: "precheck" | "checking_bag", value: boolean) {
    if (!userId) return;
    setProfile({ [key]: value });
    updateProfile(userId, { [key]: value }).catch(() => setProfile({ [key]: !value }));
  }

  async function restore() {
    setBusy("restore");
    try {
      const ok = await restorePurchases();
      setProActive(ok);
      Alert.alert(ok ? "Pro restored" : "Nothing to restore", ok ? "Welcome back!" : "We didn't find an active subscription for this Apple ID.");
    } catch {
      Alert.alert("Restore failed", "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account, trips and alerts. If you have a subscription, cancel it in Settings → Apple ID → Subscriptions.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy("delete");
            try {
              await deleteAccount();
            } catch (e) {
              Alert.alert("Couldn't delete", (e as Error).message);
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <View>
        <T kind="h1">Profile</T>
        <T kind="caption">{session?.user.email}</T>
      </View>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T kind="h3">Subscription</T>
          <Badge tone={isPro ? "success" : "muted"}>{isPro ? "★ Pro" : "Free"}</Badge>
        </View>
        <T kind="caption">
          {isPro
            ? "Live delay & gate alerts and unlimited trips are on."
            : "Free plan: 2 upcoming trips and leave-by reminders."}
        </T>
        {isPro ? (
          <Button
            title="Manage subscription"
            variant="outline"
            onPress={() => Linking.openURL("https://apps.apple.com/account/subscriptions")}
          />
        ) : (
          <Button title="Upgrade to Pro" onPress={() => router.push("/paywall")} />
        )}
        <Pressable onPress={restore} disabled={busy === "restore"}>
          <T kind="caption" color={colors.primary}>{busy === "restore" ? "Restoring…" : "Restore purchases"}</T>
        </Pressable>
      </Card>

      <Card>
        <T kind="h3">Timing preferences</T>
        <ToggleRow
          title="TSA PreCheck"
          subtitle="Shorter security estimate"
          value={profile?.precheck ?? false}
          onChange={(v) => setPref("precheck", v)}
        />
        <ToggleRow
          title="Checking a bag"
          subtitle="Adds bag-drop time"
          value={profile?.checking_bag ?? false}
          onChange={(v) => setPref("checking_bag", v)}
        />
      </Card>

      <Card>
        <T kind="h3">Recent alerts</T>
        {alerts.length === 0 ? (
          <T kind="caption">Delay, gate and cancellation updates for your flights will show here.</T>
        ) : (
          alerts.slice(0, 8).map((a) => (
            <View key={a.id} style={{ flexDirection: "row", gap: 10 }}>
              <Ionicons
                name={a.kind === "gate" ? "swap-horizontal" : a.kind === "cancel" ? "close-circle-outline" : "time-outline"}
                size={18}
                color={a.kind === "cancel" ? colors.danger : colors.warning}
              />
              <View style={{ flex: 1 }}>
                <T style={{ fontSize: 14 }}>{a.message}</T>
                <T kind="caption" style={{ fontSize: 12 }}>{timeAgo(a.created_at)}</T>
              </View>
            </View>
          ))
        )}
      </Card>

      <Card>
        <T kind="h3">About</T>
        {config.privacyUrl ? (
          <Pressable onPress={() => WebBrowser.openBrowserAsync(config.privacyUrl)}>
            <T color={colors.primary}>Privacy Policy</T>
          </Pressable>
        ) : null}
        <Pressable onPress={() => WebBrowser.openBrowserAsync(config.termsUrl)}>
          <T color={colors.primary}>Terms of Use</T>
        </Pressable>
        {config.supportEmail ? (
          <Pressable onPress={() => Linking.openURL(`mailto:${config.supportEmail}`)}>
            <T color={colors.primary}>Contact support</T>
          </Pressable>
        ) : null}
        <T kind="caption" style={{ fontSize: 12 }}>
          Flight data from AeroDataBox. Security wait and walk times are estimates.
        </T>
      </Card>

      <Button title="Sign out" variant="outline" onPress={signOut} />
      <Button title="Delete account" variant="danger" onPress={confirmDelete} loading={busy === "delete"} />
    </Screen>
  );
}
