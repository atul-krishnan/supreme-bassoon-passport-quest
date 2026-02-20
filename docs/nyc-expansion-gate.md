# NYC Expansion Gate

NYC rollout starts only after Bangalore pilot meets all targets for 2 consecutive weeks:

- Completion API p95 < 2s
- Offline completion sync success >= 99% within 10 min of reconnect
- No duplicate rewards from retries
- Day-2 return uplift >= 10% vs holdout from nudges
- Social loop completion rate is healthy (request -> accept -> feed visibility)

Implementation readiness already included:
- `cityId` is first-class (`blr`, `nyc`) in API/contracts
- NYC city/runtime config seeded
- NYC staging quest seeded (inactive)
