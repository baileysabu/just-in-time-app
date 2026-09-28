import { Platform } from "react-native";
import Purchases, { LOG_LEVEL, type PurchasesPackage } from "react-native-purchases";
import { config, PRO_ENTITLEMENT } from "./config";

let configured = false;

export function purchasesAvailable() {
  return Platform.OS === "ios" && !!config.revenueCatIosKey;
}

/** Call once after sign-in; ties the App Store subscription to the Supabase user id. */
export async function initPurchases(userId: string) {
  if (!purchasesAvailable()) return;
  if (!configured) {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: config.revenueCatIosKey, appUserID: userId });
    configured = true;
  } else {
    await Purchases.logIn(userId);
  }
}

export async function logOutPurchases() {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    /* already anonymous */
  }
}

export async function hasProEntitlement(): Promise<boolean> {
  if (!configured) return false;
  const info = await Purchases.getCustomerInfo();
  return !!info.entitlements.active[PRO_ENTITLEMENT];
}

export async function getProPackages(): Promise<PurchasesPackage[]> {
  if (!configured) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

/** Returns true if Pro is active after the purchase; false if the user cancelled. */
export async function buyPackage(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return !!customerInfo.entitlements.active[PRO_ENTITLEMENT];
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return false;
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!configured) return false;
  const info = await Purchases.restorePurchases();
  return !!info.entitlements.active[PRO_ENTITLEMENT];
}
