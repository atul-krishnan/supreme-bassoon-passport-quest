# Passport Quest

Passport Quest MVP implementation scaffold (Bangalore-first, NYC-ready) using Expo React Native + Supabase.

## What is implemented

- Mobile app scaffold (`apps/mobile`) with:
- Anonymous guest auth bootstrap (Supabase Auth).
- Nearby quests screen with location, map, and completion trigger.
- SQLite offline queue for deferred quest completion sync.
- Social screen for friend request/accept + feed fetch.
- Profile screen for city switch (BLR/NYC staging) + bootstrap config.
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
- `POST /v1/social/friends/accept`
- `GET /v1/users/me/profile-compare?friendUserId={uuid}`
- `GET /v1/config/bootstrap?cityId=blr|nyc`

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

## Notes

- BLR is enabled for production pilot content.
- NYC quest content is seeded but set inactive (`is_active = false`) for staging readiness.
- Gameplay mutations are server-trusted via `complete_quest` security-definer RPC + idempotency key (`user_id`, `device_event_id`).
- Anti-cheat thresholds and feature flags are city runtime config driven.

## Next recommended steps

- Add profile onboarding (`username`) and account linking UI.
- Add push nudge scheduler + control holdout assignment.
- Add load tests for completion p95 and offline sync success KPI.
