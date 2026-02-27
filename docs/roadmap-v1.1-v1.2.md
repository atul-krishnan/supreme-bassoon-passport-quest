# FlowState Product + Engineering Roadmap (v1.1 / v1.2)

Last updated: February 27, 2026  
Owner: FlowState core team

## v1.1 theme

Execution quality and consistency.

### Deliverables

1. Smarter hero-play ranking by recent behavior and local time windows.
2. Session resilience improvements:
   - resume active session after app restart
   - robust step progression retries
3. Better reward feedback:
   - richer completion state
   - clearer XP/progression deltas
4. Expanded observability:
   - per-route p95 tracking for FlowState endpoints
   - error taxonomy for play-start and step-done failures

### Success metrics

1. Hero play fetch p95 < 800ms.
2. Play-start success rate >= 98%.
3. Step-done API success rate >= 99%.
4. Session completion rate uplift vs v1 baseline.

## v1.2 theme

Adaptive execution intelligence.

### Deliverables

1. Context-aware play templates:
   - energy-aware duration shaping
   - friction-aware first-step design
2. Multi-play sequencing:
   - suggest follow-up play only after completion
   - maintain no-browse UX principle
3. Assistant memory layer:
   - recurring friction patterns
   - completion timing trends
4. National scaling hardening:
   - city-agnostic recommendation coverage
   - runtime config validation for new city rollouts

### Success metrics

1. Decisions saved per active user increases week over week.
2. Planning minutes saved per completed play increases.
3. Completion-to-repeat rate increases.
4. No regression in crash-free sessions and p95 latency SLOs.

## Sequencing rules

1. Keep FlowState as single-primary-CTA experience.
2. No reintroduction of list/search/map-first exploration surfaces.
3. Schema/API changes remain additive inside the `v1` boundary.
4. Roll out by feature flags and city runtime config, not client forks.
