# Observability Playbook (Sentry + PostHog)

Last updated: February 27, 2026

## Purpose

1. Sentry: app health and reliability.
2. PostHog: product behavior and execution funnel quality.

## Code references

- Sentry init: `/Users/atulkrishnan/Documents/Passport Quest/apps/mobile/src/observability/sentry.ts`
- Event capture: `/Users/atulkrishnan/Documents/Passport Quest/apps/mobile/src/analytics/events.ts`
- Gate checks: `/Users/atulkrishnan/Documents/Passport Quest/scripts/gates/staging-gate-check.mjs`

## Event funnel to monitor

1. `app_bootstrap_success`
2. `onboarding_completed`
3. `flow_diagnostic_completed`
4. `flow_hero_play_ready`
5. `flow_play_started`
6. `flow_play_step_done`
7. `flow_play_completed`

## Alert definitions

### Sentry

1. Crash-free sessions below `99.5%` in rolling 60 minutes.
2. New issue spike above baseline.
3. Release regression after `release_sha` changes.

### Product/KPI

1. Hero play latency p95 breach.
2. Play start latency p95 breach.
3. Step done latency p95 breach.
4. Duplicate reward integrity breach (`> 0`).

## Daily operating routine (15 min)

1. Review crash-free sessions and newly introduced issues.
2. Review FlowState funnel drop-offs.
3. Review gate metrics and API error spikes.
4. Log pass/fail and blockers in runbook.

## Incident severity

1. P0: auth outage, crash wave, or duplicate reward integrity breach.
2. P1: sustained FlowState API latency breach.
3. P2: funnel regression without hard reliability failure.
