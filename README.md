# Passport Quest

Passport Quest MVP v1 implementation scaffold (India-first: BLR pilot, DEL/PUNE post-gate) using Expo React Native + Supabase.

## What is implemented

- Mobile app scaffold (`apps/mobile`) with:
- Anonymous guest auth bootstrap (Supabase Auth).
- Username onboarding for first-time guest sessions.
- Nearby quests screen with location, map, and completion trigger.
- SQLite offline queue for deferred quest completion sync.
- Social screen with username-based friend request, incoming pending accepts, feed, and profile compare.
- Profile screen with edit profile (username/avatar), badges, city switch (BLR/NYC staging), and offline sync status.
- Shared API/contracts package (`packages/shared`).
- Supabase schema + RLS + seeded BLR/NYC runtime config (`supabase/migrations`).
- Supabase Edge Function router implementing v1 endpoints (`supabase/functions/v1`).
- SQL tests (`supabase/tests/mvp.sql`).

## Repo layout

- `/Users/atulkrishnan/Documents/Passport Quest/apps/mobile`
- `/Users/atulkrishnan/Documents/Passport Quest/packages/shared`
- `/Users/atulkrishnan/Documents/Passport Quest/supabase/migrations`
- `/Users/atulkrishnan/Documents/Passport Quest/supabase/functions/v1`
- `/Users/atulkrishnan/Documents/Passport Quest/docs`

## API routes implemented

All routes are served by the Supabase Edge Function `v1` and map to:

- `GET /v1/quests/nearby?cityId=blr|nyc&lat={number}&lng={number}&radiusM={number}`
- `POST /v1/quests/complete`
- `GET /v1/social/feed?limit={number}&cursor={string?}`
- `POST /v1/social/friends/request`
- `POST /v1/social/friends/request-by-username`
- `POST /v1/social/friends/accept`
- `GET /v1/social/friend-requests/incoming?status={pending|accepted|rejected|cancelled}`
- `GET /v1/users/me/profile-compare?friendUserId={uuid}`
- `GET /v1/config/bootstrap?cityId=blr|nyc`
- `GET /v1/users/me/summary`
- `GET /v1/users/me/badges`
- `PATCH /v1/users/me/profile`
- `POST /v1/notifications/register-token`

## Local setup

1. Install dependencies.

```bash
npm install
```

2. Start Supabase locally.

```bash
npm run local:up
```

3. Apply migrations and seed data.

```bash
npm run local:reset
```

4. Serve the Edge Function.

```bash
npm run local:functions
```

5. Update `apps/mobile/app.json` `expo.extra.supabaseAnonKey` with your local anon key.

6. Start mobile app.

```bash
npm run mobile:start
```

7. Optional status check.

```bash
npm run local:status
```

## Rollout strategy

- Bangalore (`blr`) is the only production pilot city in MVP v1.
- Delhi (`del`) and Pune (`pune`) are post-BLR gate rollout cities.
- NYC stays staging-ready in code/contracts, not near-term rollout messaging.

## Notes

- Gameplay mutations are server-trusted via `complete_quest` security-definer RPC + idempotency key (`user_id`, `device_event_id`).
- Anti-cheat thresholds, quiet hours, feature flags, and experiment variant resolution flow through bootstrap/runtime config.

## Architecture docs

- Architecture overview: `/Users/atulkrishnan/Documents/Passport Quest/docs/architecture.md`
- ADR process: `/Users/atulkrishnan/Documents/Passport Quest/docs/adr/README.md`
- ADR template: `/Users/atulkrishnan/Documents/Passport Quest/docs/adr/0000-template.md`
- India rollout gate: `/Users/atulkrishnan/Documents/Passport Quest/docs/india-expansion-gate.md`
- Trip context model: `/Users/atulkrishnan/Documents/Passport Quest/docs/trip-context-model.md`
- v1.1/v1.2 roadmap: `/Users/atulkrishnan/Documents/Passport Quest/docs/roadmap-v1.1-v1.2.md`

## Next recommended steps

- Add DEL/PUNE post-gate migration slice and city content packs.
- Add push nudge scheduler worker and KPI alerting automation.
- Add deeper load tests for completion p95 and offline sync SLA.
