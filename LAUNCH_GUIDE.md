# Just In Time — iOS Launch Guide

This guide takes the app from this repo to the App Store. You **don't need a Mac**: Expo's cloud service (EAS) builds and submits the iOS app for you from Windows.

Follow the steps in order. Each one says what to copy and where to paste it.

---

## What's in this repo

| Folder | What it is |
|---|---|
| `mobile/` | The iOS app (Expo / React Native) |
| `supabase/` | Backend: database, security rules, and server functions |
| everything else | The original Lovable web prototype (left untouched) |

**The app includes:**
- Email sign-in with a 6-digit code (no passwords)
- Add a flight by number and date, with **real** status, terminal, gate, and delays (AeroDataBox)
- Import flights from the iPhone calendar
- A live **leave-by countdown** covering drive (live traffic), TSA estimate, walk to gate, and boarding buffer
- Adjustable +/- time for each segment, saved per trip
- **Local notifications**: "leave in 30 min" and "time to leave" (all users)
- **Push alerts** for delays, gate changes, cancellations, and boarding (Pro, checked every 10 minutes)
- Journey milestones (left home → airport → security → gate) with actual-time stats
- Pro subscription through Apple in-app purchase (RevenueCat), with restore purchases
- Free plan: 2 upcoming trips. Pro: unlimited trips plus live alerts. The limit is enforced in the database.
- Account deletion, privacy and terms links, and subscription disclosures (all required by Apple)

**Left out of v1 on purpose:** eSIM and ride booking (these need partner deals), terminal maps (no reliable data source), and the lock-screen Live Activity countdown (planned for v1.1; it needs a native iOS widget).

---

## Accounts you need

| Service | Why | Cost |
|---|---|---|
| Apple Developer Program | Publishing on the App Store | $99/year |
| Expo (expo.dev) | Cloud builds and App Store submission | Free plan to start |
| Supabase (supabase.com) | Accounts, database, server functions | Free to start. Pro ($25/mo) is recommended at launch because free projects pause when inactive. |
| RapidAPI → AeroDataBox | Live flight data | Free tier to test, then a paid tier sized to your users |
| Google Cloud (Routes API) | Live-traffic drive time | Monthly free allowance. Optional: without it the app estimates the drive from distance. |
| RevenueCat | Manages subscriptions | Free until you earn $2.5k/month |
| Resend (or any SMTP provider) | Sends the sign-in code emails | Free tier |

> Prices change, so check each site's current pricing.

---

## Step 1: Supabase (backend)

1. Create a project at supabase.com. Pick the US East region.
2. **Project Settings → API**: copy the **Project URL** and the **anon public key**. You'll need them in Step 6.
3. Install the Supabase CLI on your computer (<https://supabase.com/docs/guides/cli>), then from this repo's folder run:
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   supabase functions deploy flight-lookup
   supabase functions deploy drive-time
   supabase functions deploy refresh-flights --no-verify-jwt
   supabase functions deploy delete-account
   supabase functions deploy revenuecat-webhook --no-verify-jwt
   ```
4. Set the server secrets. Make up two long random strings for the two `*_SECRET` values:
   ```bash
   supabase secrets set AERODATABOX_API_KEY=your_rapidapi_key
   supabase secrets set GOOGLE_MAPS_API_KEY=your_google_key
   supabase secrets set CRON_SECRET=some-long-random-string
   supabase secrets set REVENUECAT_WEBHOOK_SECRET=another-long-random-string
   ```
5. **Database → Extensions**: enable `pg_cron` and `pg_net`. Then open `supabase/cron.sql`, replace `<PROJECT_REF>` and `<CRON_SECRET>`, and run it in the **SQL Editor**. This re-checks flights every 10 minutes.
6. **Authentication → Emails → SMTP Settings**: connect Resend or another SMTP provider. Supabase's built-in email is heavily rate-limited and **will not work for real users**.
7. **Authentication → Emails → Templates → Magic Link**: replace the body with:
   ```html
   <h2>Your Just In Time code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```
8. **App Review account**: under **Authentication → Users → Add user**, create `appreview@yourdomain.com` with a password and tick "Auto confirm". Apple's reviewers can't receive your emails, so this account signs in with that password.

## Step 2: Flight data (AeroDataBox)

1. Sign up at <https://rapidapi.com>, search for **AeroDataBox**, and subscribe to a plan.
2. Copy your `X-RapidAPI-Key`. That's the `AERODATABOX_API_KEY` from Step 1.4.

## Step 3: Drive time (Google, optional but recommended)

1. At <https://console.cloud.google.com>, create a project and enable the **Routes API**.
2. **Credentials → Create API key**. Restrict it to the Routes API. This key only lives on the server.
3. This is the `GOOGLE_MAPS_API_KEY` from Step 1.4.

## Step 4: Apple (App Store Connect)

1. Enroll in the Apple Developer Program at <https://developer.apple.com/programs/>. Approval can take 1–2 days.
2. In **App Store Connect → Apps → +**, create a new app:
   - Bundle ID: `com.justintime.flight.tracker`. To change it, also edit `mobile/app.json`.
   - SKU: `justintime`
3. Once the app is created, copy its **Apple ID** number (under App Information) into `mobile/eas.json` → `ascAppId`.
4. **Monetization → Subscriptions**: create a subscription group "Pro" with two products:
   - `jit_pro_monthly`: 1 month, $4.99
   - `jit_pro_annual`: 1 year, $39.99
5. **Business**: sign the Paid Apps agreement and add your bank and tax details. **Subscriptions won't work until this is done.**

## Step 5: RevenueCat (subscriptions)

1. Create a project at <https://app.revenuecat.com> and add an **App Store** app with bundle ID `com.justintime.flight.tracker`. Upload an In-App Purchase key from App Store Connect; RevenueCat walks you through it.
2. **Products**: import `jit_pro_monthly` and `jit_pro_annual`.
3. **Entitlements**: create one called exactly **`pro`** and attach both products.
4. **Offerings**: the "default" offering should hold two packages, **Monthly** and **Annual**, each with the matching product.
5. **API keys**: copy the **Apple public key** (it starts with `appl_`).
6. **Integrations → Webhooks**:
   - URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/revenuecat-webhook`
   - Authorization header: `Bearer <your REVENUECAT_WEBHOOK_SECRET>`

## Step 6: Expo and building the app

1. Install Node.js 20+ (<https://nodejs.org>), then:
   ```bash
   npm install -g eas-cli
   cd mobile
   npm install
   npx expo install --fix      # aligns package versions with the Expo SDK
   eas login
   eas init                    # links the project; writes projectId into app.json
   ```
2. Add the app settings in Expo. Run these once each, filling in the value after `--value`:
   ```bash
   eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR_REF.supabase.co
   eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR_ANON_KEY
   eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_xxx
   eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_REVIEW_EMAIL --value appreview@yourdomain.com
   eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_PRIVACY_URL --value https://yourdomain.com/privacy
   eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SUPPORT_EMAIL --value support@yourdomain.com
   ```
   Repeat them with `--environment preview` for test builds.
3. Build:
   ```bash
   eas build --platform ios --profile production
   ```
   The first time, EAS asks for your Apple ID and creates the certificates for you. Answer **Yes** to everything. The build takes about 15–25 minutes in the cloud.
4. Send it to TestFlight:
   ```bash
   eas submit --platform ios --latest
   ```
5. In App Store Connect → **TestFlight**, add yourself as a tester and install the app on your iPhone with the TestFlight app. **Test everything on a real phone before submitting.**

## Step 7: Test checklist (on your iPhone via TestFlight)

- [ ] Sign in with your email code
- [ ] Add a real flight for today or tomorrow. Status, terminal, and gate appear.
- [ ] Allow location. The drive time shows "● live".
- [ ] The countdown ticks, and the +/- buttons change the leave-by time.
- [ ] "Leave in 30 min" and "Time to leave" notifications arrive
- [ ] Import from calendar finds a test event titled "Flight AA 100"
- [ ] A 3rd upcoming flight on the free plan shows the upgrade prompt
- [ ] Buy Pro with a Sandbox tester (App Store Connect → Users → Sandbox). After about 10 min, a delayed flight triggers a push.
- [ ] Restore purchases works after deleting and reinstalling
- [ ] Delete account works

## Step 8: Submit for review

In App Store Connect → your app → the new version:
1. **Screenshots**: 6.9" iPhone (1320×2868 or 1290×2796). Take them on your phone from TestFlight.
2. **Description, keywords, support URL, privacy policy URL.** A privacy policy is required; you can host a simple one on any site.
3. **App Privacy**: declare Email (account), Precise Location (app functionality, not tracking), Purchases, and Device ID (push token). None of it is used for tracking.
4. **Subscriptions**: attach both subscriptions to this version.
5. **App Review Information → Sign-in required**: give `appreview@yourdomain.com` and its password. In Notes, write:
   *"Enter the email, tap Continue, then type the password into the code field. Add flight number e.g. AA100 for tomorrow."*
6. Submit. Review usually takes 1–3 days.

---

## Updating the app later

- **Code change** → bump `version` in `mobile/app.json` → `eas build` → `eas submit`.
- **Backend change** → `supabase functions deploy <name>`, or add a new migration and run `supabase db push`.

## Roadmap ideas (v1.1+)

- Lock-screen **Live Activity** and Dynamic Island countdown
- Sign in with Apple
- Real TSA wait data (paid provider) instead of estimates
- Terminal maps for top airports
- Partner links (Uber, parking, eSIM) once agreements are in place
- Android (the same codebase builds for Android with `eas build --platform android`)
