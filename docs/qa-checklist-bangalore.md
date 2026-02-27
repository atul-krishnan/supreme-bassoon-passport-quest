# FlowState v1 QA Checklist

## Scope

- Platform: iOS + Android real devices.
- Build target: local dev-client or staging build.
- Critical journey: Diagnostic onboarding -> Instant Play -> Active execution -> Achievement loop.

## Environment readiness

1. Supabase project (local/staging) is reachable.
2. Edge Function `v1` is deployed/served and auth is functional.
3. Mobile env uses correct `API_BASE_URL`, `SUPABASE_URL`, and publishable key.
4. Device clock/timezone are correct.
5. Push permissions can be requested on-device.

## Core journey (must pass)

1. Launch app and confirm session bootstraps.
2. If first session, diagnostic onboarding appears.
3. Complete diagnostic with each required selector:
   - Energy baseline
   - Focus pillar
   - Friction point
4. Confirm completion message: "Diagnostic Complete. Decisions handled. Your first Play is ready."
5. Land on home and verify only one hero play is presented (no list/search/map browsing UI).
6. Verify hero card contains a one-line `why` trust signal.
7. Tap `Start Play 🚀` and confirm play session route opens.
8. In execution mode, verify:
   - Current step is visually emphasized
   - Countdown timer is visible
   - `Mark Done` advances step state
9. Complete all play steps and verify XP reward loop triggers.
10. Open profile and confirm:
    - XP bar updates
    - Decisions Saved updates
    - Plays Completed updates
    - Planning hours saved is displayed

## Network resilience (must pass)

1. Start play on a stable network.
2. Switch device to offline during an active step.
3. Tap `Mark Done` and verify UX shows graceful failure/retry behavior (no crash/no stuck spinner).
4. Restore network and retry; verify step transitions and totals stay consistent (no duplicate reward).
5. Repeat with constrained network (Slow 3G profile/Network Link Conditioner) and verify app remains responsive.

## City-agnostic behavior

1. Validate hero play retrieval with and without explicit city context.
2. Validate no city-specific hardcoding in user-facing copy except data-driven play content.
3. Verify no BLR-only UI gates block core FlowState journey.

## Observability and API sanity

1. Confirm authenticated `GET /v1/health` succeeds.
2. Confirm `/v1/config/bootstrap` and `/v1/users/me/summary` succeed after app bootstrap.
3. Confirm FlowState events are emitted in debug logs:
   - `flow_diagnostic_completed`
   - `flow_hero_play_ready`
   - `flow_play_started`
   - `flow_play_step_done`
   - `flow_play_completed`
4. Confirm no legacy quest/social routes are called during the FlowState journey.

## Evidence to capture per run

1. Device model + OS version.
2. Build identifier and release SHA.
3. Screenshots for onboarding completion, hero play, active step, and profile stats.
4. Any API errors with `x-request-id`.
5. Pass/fail status with reproduction notes for failures.
