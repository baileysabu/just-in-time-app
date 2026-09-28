import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold } from "@expo-google-fonts/dm-sans";
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider, useApp } from "@/lib/store";
import { colors, fonts } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        {fontsLoaded ? <RootNavigator /> : null}
      </AppProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { ready, session, profile, selectTrip } = useApp();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Tapping a notification opens the related trip
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const tripId = res.notification.request.content.data?.tripId;
      if (typeof tripId === "string") {
        selectTrip(tripId);
        router.navigate("/");
      }
    });
    return () => sub.remove();
  }, [selectTrip]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const signedIn = !!session;
  const onboarded = !!profile?.onboarded;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.displaySemi },
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="add-flight"
          options={{ presentation: "modal", headerShown: true, title: "Add flight" }}
        />
        <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
      </Stack.Protected>
    </Stack>
  );
}
