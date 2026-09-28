// Colours and fonts carried over from the Lovable prototype (styles.css).
export const colors = {
  background: "#121212",
  card: "#1E1E1E",
  elevated: "#262626",
  border: "#333333",
  input: "#2D3748",
  text: "#FFFFFF",
  muted: "#A0AEC0",
  primary: "#00E5FF", // neon blue
  primaryText: "#121212",
  accent: "#00D2FF",
  highlight: "#FFD700", // neon yellow — times & priority
  warning: "#FFE600",
  danger: "#FF4D6D",
} as const;

export const fonts = {
  display: "SpaceGrotesk_700Bold",
  displaySemi: "SpaceGrotesk_600SemiBold",
  body: "DMSans_400Regular",
  bodyMedium: "DMSans_500Medium",
  bodySemi: "DMSans_600SemiBold",
} as const;

export const radius = { sm: 10, md: 14, lg: 18, xl: 24 } as const;
