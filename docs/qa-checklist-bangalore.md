# Bangalore Phase A QA Checklist (Plan-First V1)

Last updated: February 26, 2026

## Environment sanity

1. Staging API and Supabase project reachable.
2. Edge function `/v1` deployed with latest migration.
3. Mobile build points to staging (`APP_ENV=staging`).
4. `planV1Enabled=true` in staging bootstrap config.
5. Location permission granted on test device.

## Core plan loop (must pass)

1. Launch app and bootstrap guest/auth session.
2. Land on `Plan` tab as primary entry.
3. Tap `Plan Now`, submit plan context sheet.
4. Verify recommended plans are returned with `Why this is recommended`.
5. Start a recommended plan and open experience detail.
6. Claim reward from detail and verify completion status.
7. Return to app and verify progress updates.

## Save/share and persistence

1. Save a plan from `Plan` tab.
2. Save a plan from experience detail (recommended source).
3. Verify saved plan appears in `Saved plans` preview.
4. Share action opens native share sheet on both plan and detail surfaces.
5. Save same plan twice and verify upsert behavior (no duplicate item).

## Trip context and feedback instrumentation

1. Verify `trip_context_started` event emitted.
2. Verify recommendation feedback events emitted for `shown/opened/started/saved`.
3. Complete a recommended experience and verify `recommended_quest_completed`.
4. Verify `recommendation_feedback_submitted` event payload includes `feedbackType`.

## Explore/progress/social/profile sanity

1. `Explore` tab map renders and nearby quest opens detail.
2. `Progress` tab shows level card, XP bar, badges.
3. `Social` tab shows max 10 recent feed items.
4. `Profile` screen edits profile and shows runtime metadata.
5. Production build must not show QA city switcher controls.

## Thaliparamba remote testing path

1. From Thaliparamba, enable test location for Bangalore.
2. Generate Bangalore plans using QA city mode in non-production.
3. Validate start/save/share flows without physical Bangalore presence.
4. Verify offline queue replay and no duplicate reward behavior.
5. Capture screenshot/video evidence per day in `/docs/uat-evidence/`.

## Security and RLS sanity

1. Unauthorized calls return `401`.
2. Cross-user reads for saved plans/trip context are blocked.
3. `quest_experience_tags` write attempts from auth user are denied.
