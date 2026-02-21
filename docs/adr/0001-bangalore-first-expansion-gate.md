# ADR 0001: Bangalore-first launch with KPI-gated NYC expansion

- Status: Superseded by ADR 0002
- Date: 2026-02-21
- Authors: Atul Krishnan, Codex
- Related ticket/PR: MVP launch direction (initial architecture baseline)

> Superseded on February 21, 2026 by `0002-india-first-rollout-delhi-pune.md`.
> NYC remains staging-only in near-term rollout.

## Context

Passport Quest was originally framed around a NYC-first pilot, but day-1 execution risk is materially lower when launch operations, quest curation, and real-world testing are local to the builder/team.

The product still needs to preserve NYC as the first expansion thesis, while avoiding a brittle one-city implementation that would require major rewrites.

## Decision

Launch production in Bangalore (`cityId=blr`) first, and keep NYC (`cityId=nyc`) staging-ready but inactive until expansion gate metrics are met for two consecutive weeks.

Expansion gate metrics:

- `POST /v1/quests/complete` p95 latency under 2s.
- Offline completion sync success >= 99% within 10 minutes of reconnect.
- Zero duplicate rewards from retries (idempotency integrity).
- Day-2 return uplift >= +10% from nudge experiment vs holdout.
- Social loop health: request -> accept -> feed visibility flow functioning at acceptable conversion.

## Options considered

1. NYC-first production launch.
2. Bangalore-first launch with NYC expansion gate.
3. Dual-city simultaneous launch.

## Decision drivers

- Faster iteration and validation with local on-ground testing.
- Lower content and operational risk during MVP window.
- Need to preserve future city portability without overengineering.

## Consequences

### Positive

- Quicker validation cycles for quest quality, anti-cheat behavior, and UX friction.
- Lower launch risk while still preserving NYC roadmap alignment.
- Better data quality before multi-city live ops complexity.

### Negative

- NYC go-live is delayed until KPI gate is met.
- Additional coordination needed to ensure NYC staging data remains current.

### Neutral

- API and schema remain city-agnostic; no forced client architecture split.

## Implementation plan

1. Keep `cityId` first-class in contracts/endpoints and city-aware queries.
2. Run Bangalore as default active city in client and seed production content for BLR.
3. Keep NYC seeded/staging-ready, disabled by config/content gate.
4. Track expansion KPIs continuously and trigger NYC activation only after two compliant weeks.

## Migration and rollback

- Migration steps:
- Maintain additive-only DB migrations for all city/runtime/API fields.
- Use `city_runtime_config` feature flags and `quests.is_active` controls for staged activation.
- Rollback steps:
- If expansion rollout degrades KPIs, disable `nyc` live flags/content and revert to BLR-only operations without contract rollback.

## Security and privacy impact

- Auth/RLS impact: no reduction in posture; existing JWT + RLS model remains.
- Secret handling impact: no new secret class introduced.
- Data exposure impact: unchanged; city scope is logical partitioning, not security boundary.

## Observability impact

- Metrics:
- Completion latency p95, offline sync success, duplicate completion rate, D2 retention uplift, social funnel conversion.
- Logs:
- Security event logging for rejected/abnormal completion attempts.
- Alerts:
- Trigger alert when completion p95 or sync success breaches gate thresholds.

## Testing impact

- Unit:
- City-id branching and config parsing behavior.
- Integration:
- End-to-end flows with `cityId=blr` and staged `cityId=nyc`.
- End-to-end:
- Guest onboarding -> 3 quests -> first badge loop in Bangalore.

## Open questions

- Define explicit numeric target for “healthy” social loop conversion.
- Define operational runbook and ownership for NYC gate decision meeting.

## References

- `/Users/atulkrishnan/Documents/Passport Quest/docs/architecture.md`
- `/Users/atulkrishnan/Documents/Passport Quest/docs/india-expansion-gate.md`
- `/Users/atulkrishnan/Documents/Passport Quest/claude.md`
