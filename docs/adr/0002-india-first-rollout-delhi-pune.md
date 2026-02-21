# ADR 0002: India-first rollout path (BLR -> DEL -> PUNE)

- Status: Accepted
- Date: 2026-02-21
- Authors: Atul Krishnan, Codex
- Related ticket/PR: MVP v1 completion strategy update

## Context

Passport Quest launched architecture with Bangalore-first and NYC-next. Product and execution priorities now require an India-first sequence where Bangalore is completed and validated first, then Delhi and Pune are activated city-by-city using the same KPI gate policy.

The system must keep NYC in staging-ready code paths for compatibility and future expansion, but rollout messaging and near-term operations should be India-focused.

## Decision

Adopt India-first rollout policy:

1. Bangalore is the only production pilot city in MVP v1.
2. Delhi (`del`) and Pune (`pune`) are the next rollout cities, activated only after Bangalore KPI gate passes.
3. Each new city uses the same KPI threshold set and the same two-week stability gate before activation.
4. NYC remains staging-only and is removed from near-term rollout strategy.

## Options considered

1. Continue Bangalore -> NYC.
2. India-first Bangalore -> Delhi -> Pune.
3. Multi-city simultaneous launch.

## Decision drivers

- Faster local validation and curation cycles.
- Lower operational risk by adding one city at a time.
- Reuse of existing city-aware contracts without architecture churn.

## Consequences

### Positive

- Clear rollout governance with repeatable activation policy.
- Better quality control before expanding internationally.

### Negative

- International rollout is deferred.
- Requires disciplined KPI instrumentation and weekly reviews.

### Neutral

- v1 API remains additive-only and city-aware.

## Implementation plan

1. Update architecture and rollout docs to India-first language.
2. Complete Bangalore MVP v1 functional and reliability gaps.
3. Keep NYC support in staging code/config, but not in rollout messaging.
4. After KPI gate pass, add `del` and `pune` seeds/config in a dedicated post-gate migration slice.

## Migration and rollback

- Migration steps:
- Additive-only schema/API updates for MVP v1 completion.
- Post-gate city seed/config additions for `del` and `pune`.
- Rollback steps:
- Disable newly activated city by config/content flags if KPI drift occurs.
- Keep schema/API intact to avoid breaking clients.

## Security and privacy impact

- Auth/RLS impact: unchanged, continue strict per-user boundaries.
- Secret handling impact: no new secret class.
- Data exposure impact: unchanged; city scope remains product partitioning, not auth partitioning.

## Observability impact

- Metrics:
- Completion p95 latency.
- Offline sync success within 10 minutes.
- Duplicate reward rate.
- D2 uplift treatment vs control.
- Social loop conversion request -> accept -> feed visibility.
- Logs:
- Quest rejection/security events and social mutation outcomes.
- Alerts:
- Trigger when KPI thresholds breach gate criteria.

## Testing impact

- Unit:
- Username onboarding validation, deterministic experiment assignment.
- Integration:
- Completion acceptance/rejection/duplicate and offline replay idempotency.
- Social request-by-username + incoming accept flows.
- End-to-end:
- Bangalore first-session 3 quests + first badge path.

## Open questions

- Exact baseline target for social conversion gate by cohort size.
- Promotion checklist and ownership for DEL/PUNE activation reviews.

## References

- `/Users/atulkrishnan/Documents/Passport Quest/docs/architecture.md`
- `/Users/atulkrishnan/Documents/Passport Quest/docs/india-expansion-gate.md`
- `/Users/atulkrishnan/Documents/Passport Quest/docs/adr/0001-bangalore-first-expansion-gate.md`
