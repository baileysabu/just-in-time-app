# Handoff: Just In Time iOS app

Status as of 28 Sep 2026. Follow the full instructions in [`LAUNCH_GUIDE.md`](LAUNCH_GUIDE.md).

## Already done

- [x] Code: Expo iOS app in `mobile/`, backend in `supabase/`
- [x] Supabase project **Just In Time app** (ref `wqlthbdxrssoavraedha`, East US)
- [x] Database schema applied: `supabase/migrations/20260928000000_init.sql`
- [x] Edge functions deployed from the dashboard editor using the single-file versions in `supabase/paste-into-dashboard/`, all with **Verify JWT = OFF**: `flight-lookup`, `drive-time`, `refresh-flights`, `delete-account`, `revenuecat-webhook`
- [x] Secrets set: `AERODATABOX_API_KEY`, `CRON_SECRET`, `REVENUECAT_WEBHOOK_SECRET` (the owner has the two secret values)
- [x] Scheduled flight refresh (pg_cron every 10 min → `refresh-flights`) *(confirm it's listed under Integrations → Cron)*

## Still to do

1. **Optional:** set `GOOGLE_MAPS_API_KEY` for live-traffic drive times (Guide Step 3). Without it, the app estimates the drive from distance.
2. **Email sign-in codes** (Guide Steps 1.6–1.7): set up custom SMTP, and add `{{ .Token }}` to the Magic Link template. Required before real users sign in.
3. **App Review account** (Guide Step 1.8)
4. **Apple / App Store Connect**: create the app with bundle ID `com.hillig.justintime` and the two subscriptions (Guide Step 4)
5. **RevenueCat**: `pro` entitlement, default offering, webhook using `REVENUECAT_WEBHOOK_SECRET` (Guide Step 5)
6. **Expo/EAS**: `eas init`, set the `EXPO_PUBLIC_*` env vars, first build (Guide Step 6). Use the project's **publishable key** as `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
7. TestFlight testing, then App Store submission (Guide Steps 7–8)

## Notes for the developer

- The app has **never been compiled**: it was written in an environment without npm access. Run `npm install && npx expo install --fix && npx tsc --noEmit` first, and expect some small fixes on the first build.
- Business logic has unit tests: `cd mobile && npx tsx --test tests/*.test.ts` (10 passing).
- The DB schema (RLS, free-plan trip limit, push-token RPC, cascade deletes) was tested against Postgres 16.
- The edge functions read either the legacy `SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` or the newer `SUPABASE_PUBLISHABLE_KEYS`/`SUPABASE_SECRET_KEYS`, whichever the project provides.
- The flattened files at the repo root are the old Lovable web prototype. They're kept for reference only and aren't used by the app.
