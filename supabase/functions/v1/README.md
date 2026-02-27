# v1 Edge Function

Supabase function router for Passport Quest API surface.

## Route examples (FlowState-only)

```bash
# bootstrap config
curl -H "Authorization: Bearer <jwt>" \
  "http://127.0.0.1:54321/functions/v1/v1/config/bootstrap?cityId=blr"

# health
curl -H "Authorization: Bearer <jwt>" \
  "http://127.0.0.1:54321/functions/v1/v1/health"

# save diagnostic
curl -X POST -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  "http://127.0.0.1:54321/functions/v1/v1/flowstate/diagnostic" \
  -d '{
    "energyBaseline": "balanced",
    "focusPillar": "deep_work",
    "frictionPoint": "procrastination"
  }'

# get hero play
curl -H "Authorization: Bearer <jwt>" \
  "http://127.0.0.1:54321/functions/v1/v1/flowstate/play/hero?cityId=blr"

# start play session
curl -X POST -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  "http://127.0.0.1:54321/functions/v1/v1/flowstate/play/start" \
  -d '{"recommendationId":"<recommendation-uuid>"}'

# mark current step done
curl -X POST -H "Authorization: Bearer <jwt>" \
  "http://127.0.0.1:54321/functions/v1/v1/flowstate/play/sessions/<session-uuid>/steps/1/done"

# flow summary
curl -H "Authorization: Bearer <jwt>" \
  "http://127.0.0.1:54321/functions/v1/v1/flowstate/summary"

# patch profile
curl -X PATCH -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  "http://127.0.0.1:54321/functions/v1/v1/users/me/profile" \
  -d '{"username":"atul_explorer","avatarUrl":"https://images.example/avatar.png"}'
```

## Response metadata headers

All routes now include:

- `x-request-id`: per-request trace id for debugging and incident correlation.
- `x-release-sha`: release build identifier for parity checks and rollbacks.
