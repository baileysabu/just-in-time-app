import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { Badge, Button, Input, Screen, T } from "@/components/ui";
import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { colors, fonts } from "@/lib/theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Passwordless sign-in: enter email → receive a 6-digit code → verify.
 * New emails automatically create an account.
 */
export default function SignIn() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const cleanEmail = email.trim().toLowerCase();
  const isReviewer = !!config.reviewEmail && cleanEmail === config.reviewEmail;

  async function sendCode() {
    if (!EMAIL_RE.test(cleanEmail)) {
      Alert.alert("Check your email", "Please enter a valid email address.");
      return;
    }
    if (isReviewer) {
      // App Review account signs in with a password instead of an emailed code
      setStep("code");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      Alert.alert("Couldn't send code", error.message);
      return;
    }
    setStep("code");
  }

  async function verify() {
    setLoading(true);
    const { error } = isReviewer
      ? await supabase.auth.signInWithPassword({ email: cleanEmail, password: code })
      : await supabase.auth.verifyOtp({ email: cleanEmail, token: code.trim(), type: "email" });
    setLoading(false);
    if (error) Alert.alert("That didn't work", "The code is wrong or expired. Try again or resend.");
    // On success the auth listener switches screens automatically.
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <View style={{ marginTop: 48, gap: 14 }}>
          <Badge tone="primary">Door to gate, perfectly timed</Badge>
          <Text style={{ fontFamily: fonts.display, fontSize: 42, color: colors.text }}>
            Just In <Text style={{ color: colors.primary }}>Time</Text>
          </Text>
          <T kind="caption" style={{ fontSize: 15 }}>
            Your airport assistant that knows exactly when you should leave.
          </T>
        </View>

        {step === "email" ? (
          <View style={{ gap: 14, marginTop: 24 }}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={sendCode}
            />
            <Button title="Continue" onPress={sendCode} loading={loading} />
            <T kind="caption" style={{ textAlign: "center" }}>
              We'll email you a 6-digit code. No password needed.
            </T>
          </View>
        ) : (
          <View style={{ gap: 14, marginTop: 24 }}>
            <T kind="h3">{isReviewer ? "Enter password" : "Check your inbox"}</T>
            {!isReviewer ? (
              <T kind="caption">
                We sent a code to <Text style={{ color: colors.text }}>{cleanEmail}</Text>
              </T>
            ) : null}
            <Input
              value={code}
              onChangeText={setCode}
              placeholder={isReviewer ? "Password" : "123456"}
              keyboardType={isReviewer ? "default" : "number-pad"}
              textContentType={isReviewer ? "password" : "oneTimeCode"}
              autoComplete={isReviewer ? "password" : "one-time-code"}
              secureTextEntry={isReviewer}
              maxLength={isReviewer ? 128 : 8}
              autoFocus
              style={isReviewer ? undefined : { letterSpacing: 8, fontSize: 24, textAlign: "center" }}
            />
            <Button title="Sign in" onPress={verify} loading={loading} disabled={code.length < 6} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Pressable onPress={() => { setStep("email"); setCode(""); }}>
                <T kind="caption" color={colors.primary}>Change email</T>
              </Pressable>
              {!isReviewer ? (
                <Pressable onPress={sendCode}>
                  <T kind="caption" color={colors.primary}>Resend code</T>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}

        <T kind="caption" style={{ textAlign: "center", marginTop: 24, fontSize: 12 }}>
          By continuing you agree to our{" "}
          <Text style={{ color: colors.primary }} onPress={() => WebBrowser.openBrowserAsync(config.termsUrl)}>
            Terms
          </Text>{" "}
          and{" "}
          <Text
            style={{ color: colors.primary }}
            onPress={() => config.privacyUrl && WebBrowser.openBrowserAsync(config.privacyUrl)}
          >
            Privacy Policy
          </Text>
          .
        </T>
      </Screen>
    </KeyboardAvoidingView>
  );
}
