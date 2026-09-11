# Trip Management, Calendar Sync, and Dynamic Alerts

## Overview
Extend the existing local demo experience with multi-flight trip management, simulated Google/Apple calendar sync, location-alert previews, and per-trip milestone tracking while preserving the charcoal, neon yellow, and neon blue visual system.

## User Experience
- Add a compact icon-only **New Trip** action to the Dashboard header and a centered **+** action in the bottom navigation.
- Open an **Add Flight** modal with flight number, airline, departure date/time, origin, and destination fields.
- Validate required details, add the flight to the upcoming trip list, select it immediately, and update the Dashboard’s flight summary and countdown.
- Add a horizontal upcoming-flight selector to Home and Trips for switching among AA1204, DL482, UA219, and newly entered flights.
- Keep each selected trip’s route, departure, status, gate, terminal, boarding group, and milestones reflected consistently across views.

## Calendar Sync
- Add a **Sync Calendar** section inside Add Flight and Profile with Google Calendar and Apple Calendar controls.
- Treat both integrations as an intentional demo: controls toggle connected states and simulate imported flight counts.
- Show the requested active-sync banner when either source is connected, with provider-specific state and imported totals.
- Do not initiate real OAuth or external calendar access in this version.

## Dynamic Alerts
- Add a **Dynamic Location-Based Alerts** panel to Profile near Recent Alerts.
- Include the location recalculation and traffic leave-by notification examples with timestamps and status tags.
- Add a **Simulate location shift** action that displays the messages as live toast notifications.
- Mount the existing toast system once at the app root and use theme-matched toast styling.

## Milestones
- Expand journey stages to **Left Home**, **Arrived at Airport**, **Security Passed**, and **At Gate**.
- Store milestone completion independently for each trip.
- Add a compact milestone badge tracker on the Dashboard and an expanded interactive tracker on Trips.
- Preserve the existing timing analytics using the closest matching completed milestone timestamps.

## Technical Details
- Extend the existing persisted app state with `Trip`, per-trip milestones, active trip selection, calendar provider state, and add/select/toggle actions.
- Migrate older saved demo state safely by merging defaults and normalizing missing fields.
- Build focused reusable pieces for the flight selector, Add Flight modal, calendar sync controls, and milestone tracker.
- Update Home, Trips, Profile, bottom navigation, and root toast mounting only; keep authentication, Pro Pass, map, and in-flight monitor behavior intact.
- Use semantic theme tokens and existing Button/Card/Badge/Modal components throughout.

## Validation
- Verify adding and selecting flights updates Home and Trips.
- Verify milestone completion remains isolated per trip and persists after reload.
- Verify Google/Apple simulated sync states and imported counts appear in both entry points.
- Verify location simulation produces visible themed notifications.
- Check Home, Trips, Profile, and Map at mobile and desktop widths with no overlaps or console errors.
