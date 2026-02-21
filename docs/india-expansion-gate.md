# India Expansion Gate (BLR -> DEL -> PUNE)

Bangalore is the only production pilot city in MVP v1.

Delhi and Pune activate only when Bangalore meets all gate criteria for 2 consecutive weeks:

- Completion API p95 < 2s
- Offline completion sync success >= 99% within 10 min of reconnect
- Duplicate rewards from retries = 0
- Day-2 return uplift >= 10% treatment vs 10% control holdout
- Social loop conversion (request -> accept -> feed visibility) meets baseline

City-by-city activation policy:

1. Bangalore gate pass enables Delhi rollout prep and controlled activation.
2. Delhi must then pass the same 2-week gate before Pune activation.
3. Pune must pass the same gate before international rollout planning begins.

NYC policy:

- Keep NYC (`cityId=nyc`) staging-ready in code/contracts only.
- Do not include NYC in near-term production rollout messaging.
