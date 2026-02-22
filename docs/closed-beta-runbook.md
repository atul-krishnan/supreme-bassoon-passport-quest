# Closed Beta Runbook (Bangalore)

## Pre-flight (T-24h)

1. Confirm migrations applied and Edge Function deployed.
2. Confirm BLR quests active and geofence coordinates valid.
3. Confirm runtime config (`quietHours`, anti-cheat thresholds, feature flags).
4. Confirm PostHog ingestion is healthy.

## Launch day

1. Share TestFlight / Play Internal build to beta cohort.
2. Run smoke test with 2 accounts (request -> accept -> feed).
3. Verify onboarding and first quest completion path.
4. Verify offline queue replay on reconnect.

## Daily checks during beta

1. Completion API p95 and error rate.
2. Offline sync within 10-minute SLA.
3. Duplicate reward rate (must remain 0).
4. Social conversion funnel:
- request sent
- request accepted
- feed visibility

Automation support:

- CI `PR Verify` workflow enforces typecheck + unit tests + DB tests + API smoke checks.
- `Staging Gate` workflow enforces release hard-stop metrics before promotion.

## Incident playbook

1. If completion p95 breaches target:
- Inspect Edge Function logs and DB load.
- Reduce non-critical read traffic and retry.
2. If duplicate integrity regression:
- Verify `(user_id, device_event_id)` uniqueness and replay handling.
- Pause release if duplicate accepted rows appear.
3. If sync SLA drops:
- Inspect client retry/backoff behavior and API error bursts.

## Bangalore gate review (2-week window)

Bangalore can be marked “done and dusted” only if all are true:

- Product: first-session 3-quest + badge loop verified.
- Reliability: offline sync success >= 99% within 10 minutes.
- Integrity: duplicate reward rate = 0.
- Performance: completion p95 < 2s.
- Growth: D2 uplift >= +10% for treatment vs control.
- Social: request -> accept -> feed visibility conversion meets baseline.
