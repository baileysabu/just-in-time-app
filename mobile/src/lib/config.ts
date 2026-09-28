// Public build-time configuration (EXPO_PUBLIC_* values are inlined by Expo).
export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "",
  reviewEmail: (process.env.EXPO_PUBLIC_REVIEW_EMAIL ?? "").toLowerCase(),
  privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? "",
  termsUrl:
    process.env.EXPO_PUBLIC_TERMS_URL ??
    "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? "",
};

/** RevenueCat entitlement identifier configured in the RevenueCat dashboard. */
export const PRO_ENTITLEMENT = "pro";

/** Upcoming trips allowed on the free plan (also enforced in the database). */
export const FREE_TRIP_LIMIT = 2;
