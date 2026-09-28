import * as Haptics from "expo-haptics";
import type { ReactElement, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radius } from "@/lib/theme";

export function Screen({
  children,
  scroll = true,
  refreshControl,
  edges = ["top"],
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  edges?: ("top" | "bottom")[];
}) {
  return (
    <SafeAreaView style={s.screen} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={s.scrollContent}
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[s.scrollContent, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

type TextKind = "h1" | "h2" | "h3" | "body" | "label" | "caption" | "big";

export function T({
  children,
  kind = "body",
  color,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  kind?: TextKind;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[s[kind], color ? { color } : null, style]}
      maxFontSizeMultiplier={1.4}
    >
      {children}
    </Text>
  );
}

export type Tone = "primary" | "success" | "warning" | "danger" | "muted";

const toneColor: Record<Tone, string> = {
  primary: colors.primary,
  success: colors.highlight,
  warning: colors.warning,
  danger: colors.danger,
  muted: colors.muted,
};

export function Badge({ children, tone = "primary" }: { children: ReactNode; tone?: Tone }) {
  const c = toneColor[tone];
  return (
    <View style={[s.badge, { borderColor: c + "66", backgroundColor: c + "1A" }]}>
      <Text style={[s.badgeText, { color: c }]}>{children}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  const bg =
    variant === "primary" ? colors.primary : variant === "danger" ? colors.danger + "22" : "transparent";
  const fg =
    variant === "primary" ? colors.primaryText : variant === "danger" ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1 },
        variant === "outline" && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={s.row}>
          {icon}
          <Text style={[s.buttonText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {label ? <T kind="label">{label}</T> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        keyboardAppearance="dark"
        style={[s.input, style]}
        {...rest}
      />
    </View>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={[s.row, { justifyContent: "space-between", paddingVertical: 6 }]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <T style={{ fontFamily: fonts.bodySemi }}>{title}</T>
        {subtitle ? <T kind="caption">{subtitle}</T> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.elevated }}
        thumbColor="#fff"
      />
    </View>
  );
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: [K, string][];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <View style={s.segmented}>
      {options.map(([k, label]) => {
        const active = k === value;
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            style={[s.segment, active && { backgroundColor: colors.primary }]}
          >
            <Text style={[s.segmentText, { color: active ? colors.primaryText : colors.muted }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  big: { fontFamily: fonts.display, fontSize: 46, color: colors.highlight, fontVariant: ["tabular-nums"] },
  h1: { fontFamily: fonts.display, fontSize: 26, color: colors.text },
  h2: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  h3: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 15, color: colors.text, lineHeight: 21 },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  caption: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, lineHeight: 18 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 12 },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  buttonText: { fontFamily: fonts.bodySemi, fontSize: 16 },
  input: {
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  segment: { flex: 1, borderRadius: radius.md, paddingVertical: 10, alignItems: "center" },
  segmentText: { fontFamily: fonts.bodySemi, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8 },
});
