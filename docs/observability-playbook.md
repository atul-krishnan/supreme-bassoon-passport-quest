# Observability Playbook (Sentry + PostHog)

Last updated: February 23, 2026

## Short answer first

Sentry and PostHog are not the same.

1. Sentry is for app health and engineering incidents (crashes, exceptions, performance traces, release regressions).
2. PostHog is for product analytics (events, funnels, retention, experiment outcomes, feature usage).

Use both together:

1. Sentry answers: "Is the app stable?"
2. PostHog answers: "Are users progressing through the game and social loops?"

## What we track today

Code references:

- Sentry init and tags: `/Users/atulkrishnan/Documents/Passport Quest/apps/mobile/src/observability/sentry.ts`
- PostHog event capture: `/Users/atulkrishnan/Documents/Passport Quest/apps/mobile/src/analytics/events.ts`
- KPI gate script (latency/SLA/duplicates/crash-free): `/Users/atulkrishnan/Documents/Passport Quest/scripts/gates/staging-gate-check.mjs`

## Zero-cost pilot setup

### 1) Sentry setup

1. Create one Sentry project for mobile (React Native).
2. Copy DSN.
3. Set GitHub secret `SENTRY_DSN` (shared fallback for staging + production).
4. Optional: set `STAGING_SENTRY_DSN` and `PROD_SENTRY_DSN` if you want strict separation.
5. Ensure EAS env has `SENTRY_DSN` for staging/production profiles.

### 2) PostHog setup

1. Create one PostHog project.
2. Copy project host and project API key (capture key).
3. Set EAS env values:
   - `POSTHOG_HOST`
   - `POSTHOG_API_KEY`
4. For local testing, set the same keys in local env (do not commit them).

## Alert definitions (pilot-ready)

### Sentry alerts (engineering health)

1. Crash-free sessions below `99.5%` in the last 60 minutes.
2. New issue spike above normal baseline (for example: more than 20 events in 15 minutes for one issue).
3. Release regression: first-seen errors after new `release_sha` rollout.

### PostHog alerts/reports (product health)

1. Social funnel drop:
   - `social_send_friend_request` -> `social_accept_friend_request` -> `social_feed_visible`
2. Recommended quest funnel drop:
   - `recommended_quest_impression` -> `recommended_quest_opened` -> `recommended_quest_started` -> `recommended_quest_completed`
3. Offline reliability trend:
   - monitor ratio of `offline_sync_success` vs `offline_sync_retry`

Note: if your PostHog plan does not support automated alerts for some insight types, keep saved insights and review daily during pilot.

## Backend integrity and latency checks

These are already automated in staging gate:

1. completion p95 `< 2000ms`
2. nearby p95 `< 800ms`
3. offline sync SLA `>= 99%`
4. crash-free sessions `>= 99.5%`
5. duplicate accepted completions `= 0`

Workflow:

- `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/staging-gate.yml`

## Daily pilot routine (15 minutes)

1. Check Sentry: crash-free rate, new issues, release-level errors.
2. Check PostHog: social funnel, recommended funnel, daily active explorers.
3. Run/inspect staging gate result and duplicate integrity.
4. Log outcome in runbook before expanding tester cohort.

## Incident mapping

1. P0: duplicate rewards non-zero, auth outage, or crash wave blocking gameplay.
2. P1: sustained completion latency breach or offline sync SLA breach.
3. P2: social/feed/recommendation regressions.

Primary action order:

1. Disable risky flag/experiment.
2. Roll back function release.
3. Forward-fix migration issues quickly unless safe rollback exists.
