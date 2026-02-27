# Closed Beta Runbook (Bangalore)

## Pre-flight (T-24h)

1. Confirm migrations applied and Edge Function deployed.
2. Confirm FlowState templates and recommendations are available for BLR.
3. Confirm runtime config (`quietHours`, anti-cheat thresholds, feature flags).
4. Confirm PostHog ingestion is healthy.

## Launch day

1. Share TestFlight / Play Internal build to beta cohort.
2. Run smoke test with 2 accounts (diagnostic -> hero play -> session start).
3. Verify onboarding and first play completion path.
4. Verify step progression recovery on reconnect.

## Daily checks during beta

1. Hero play API p95 and error rate.
2. Play start API p95 and error rate.
3. Step done API p95 and error rate.
4. Duplicate XP award rate (must remain 0).
5. Free-tier/quota watch:
- Supabase project usage (DB/egress/auth) for both staging and production.
- EAS build usage trend.
- Pause non-critical build frequency if quotas are trending toward limits.

Automation support:

- CI `PR Verify` workflow enforces typecheck + unit tests + DB tests + API smoke checks.
- `Staging Gate` workflow enforces release hard-stop metrics before promotion.
- `ops:check:zero-cost` enforces no-branch low-cost policy in CI/workflows.

## Incident playbook

1. If FlowState latency breaches target:
- Inspect Edge Function logs and DB load.
- Reduce non-critical read traffic and retry.
2. If duplicate reward integrity regression:
- Verify play session step completion idempotency handling.
- Pause release if duplicate XP awards appear.
3. If step progression reliability drops:
- Inspect client retry/backoff behavior and API error bursts.

## Bangalore gate review (2-week window)

Bangalore can be marked “done and dusted” only if all are true:

- Product: first-session diagnostic + play completion loop verified.
- Reliability: play progression success >= 99%.
- Integrity: duplicate reward rate = 0.
- Performance: hero/start/step p95 within thresholds.
- Growth: D2 uplift >= +10% for treatment vs control.
- Execution: decision-to-action conversion meets baseline.
