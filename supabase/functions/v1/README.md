# v1 Edge Function

Supabase function router for Passport Quest API surface.

## Route examples

```bash
# nearby quests
curl -H "Authorization: Bearer <jwt>" \
  "http://127.0.0.1:54321/functions/v1/v1/quests/nearby?cityId=blr&lat=12.97&lng=77.59&radiusM=1200"

# bootstrap config
curl -H "Authorization: Bearer <jwt>" \
  "http://127.0.0.1:54321/functions/v1/v1/config/bootstrap?cityId=blr"

# complete quest
curl -X POST -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  "http://127.0.0.1:54321/functions/v1/v1/quests/complete" \
  -d '{
    "questId": "<uuid>",
    "occurredAt": "2026-02-19T14:00:00.000Z",
    "location": {"lat": 12.9763, "lng": 77.5929, "accuracyM": 12},
    "deviceEventId": "evt-123"
  }'

# request friend by username
curl -X POST -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  "http://127.0.0.1:54321/functions/v1/v1/social/friends/request-by-username" \
  -d '{"username":"friend_123"}'

# incoming pending requests
curl -H "Authorization: Bearer <jwt>" \
  "http://127.0.0.1:54321/functions/v1/v1/social/friend-requests/incoming?status=pending"

# patch profile
curl -X PATCH -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  "http://127.0.0.1:54321/functions/v1/v1/users/me/profile" \
  -d '{"username":"atul_explorer","avatarUrl":"https://images.example/avatar.png"}'

# start trip context
curl -X POST -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  "http://127.0.0.1:54321/functions/v1/v1/trips/context/start" \
  -d '{
    "cityId":"blr",
    "contextType":"family",
    "groupSize":3,
    "withKids":true,
    "pace":"relaxed",
    "budget":"medium",
    "transportMode":"car",
    "timeBudgetMin":180,
    "vibeTags":["greenery","quiet"],
    "constraints":{"avoidStairs":true}
  }'

# update trip context
curl -X PATCH -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  "http://127.0.0.1:54321/functions/v1/v1/trips/context/<tripContextId>" \
  -d '{"pace":"active","timeBudgetMin":120}'

# end trip context
curl -X POST -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  "http://127.0.0.1:54321/functions/v1/v1/trips/context/<tripContextId>/end" \
  -d '{"status":"completed"}'

# get recommended quests
curl -H "Authorization: Bearer <jwt>" \
  "http://127.0.0.1:54321/functions/v1/v1/quests/recommended?cityId=blr&tripContextId=<tripContextId>&limit=10"

# recommendation feedback
curl -X POST -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  "http://127.0.0.1:54321/functions/v1/v1/recommendations/feedback" \
  -d '{
    "tripContextId":"<tripContextId>",
    "questId":"<questId>",
    "feedbackType":"opened",
    "metadata":{"rank":2,"source":"recommended_carousel"}
  }'
```
