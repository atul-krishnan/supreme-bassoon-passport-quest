# MVP Architecture (Implemented Baseline)

## Mobile

- Expo + React Native + TypeScript + expo-router
- Server state: TanStack Query
- Session/app state: Zustand
- Offline queue: expo-sqlite
- Auth token persistence: expo-secure-store

### Offline completion flow

1. User taps quest completion.
2. App attempts `POST /v1/quests/complete`.
3. On network/API failure, request payload is queued in SQLite.
4. Background flush runs every 15s and retries due events with exponential backoff.
5. Duplicate-safe because backend enforces `(user_id, device_event_id)` uniqueness.

## Backend

- Supabase Auth anonymous sign-in enabled.
- Postgres + RLS on all gameplay/social tables.
- Trusted mutations via security-definer RPCs:
- `complete_quest`
- `request_friend`
- `accept_friend_request`
- `profile_compare`

### City runtime seams

`city_runtime_config` stores:
- quiet hours
- anti-cheat thresholds
- feature flags

This keeps city policy changes server-driven and avoids app redeploys.
