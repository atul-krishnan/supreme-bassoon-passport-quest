# v1.1 Mobile Integration Handoff

Date: February 21, 2026
Backend branch: `codex/v11-backend-foundation`

## What is ready

1. Additive schema and RPC foundation for trip context and recommendations.
2. Edge routes implemented in `/Users/atulkrishnan/Documents/Passport Quest/supabase/functions/v1/index.ts`.
3. Shared contracts updated in `/Users/atulkrishnan/Documents/Passport Quest/packages/shared/src/types.ts`.
4. Mobile API stubs added in `/Users/atulkrishnan/Documents/Passport Quest/apps/mobile/src/api/endpoints.ts`.
5. DB contract tests added in `/Users/atulkrishnan/Documents/Passport Quest/supabase/tests/v11_trip_context.sql`.

## New endpoints for mobile wiring

1. `POST /v1/trips/context/start`
2. `PATCH /v1/trips/context/{tripContextId}`
3. `POST /v1/trips/context/{tripContextId}/end`
4. `GET /v1/quests/recommended?cityId={cityId}&tripContextId={uuid}&limit={number}`
5. `POST /v1/recommendations/feedback`

## Client helpers now available

1. `startTripContext(payload)`
2. `updateTripContext(tripContextId, payload)`
3. `endTripContext(tripContextId, payload?)`
4. `getRecommendedQuests({ cityId, tripContextId, limit? })`
5. `recordRecommendationFeedback(payload)`

## Suggested mobile integration order

1. Add a lightweight trip-context state holder (`activeTripContextId`, `status`, last payload snapshot).
2. Build "Plan this outing" start sheet and call `startTripContext`.
3. Load recommendations after start using `getRecommendedQuests`.
4. Track user interactions (`shown/opened/started/completed/dismissed`) with `recordRecommendationFeedback`.
5. Add mid-trip adjust flow using `updateTripContext` then refresh recommendations.
6. Add explicit end action (`completed`/`cancelled`) via `endTripContext`.

## Contract notes

1. Existing v1 routes remain unchanged.
2. `CityId` union stays backward compatible (`"blr" | "nyc"`).
3. Recommendation payload includes `tags`, `whyRecommended`, and `score` for ranking transparency.
4. Endpoint validation returns `400` for malformed payloads, `404` for missing/inactive trip context where applicable.

## Test checklist for mobile wiring

1. Start -> update -> end lifecycle with one active context per user.
2. Recommendation list renders only active city quests.
3. Family/couple contexts show different top-ranked cards.
4. Feedback posts on impression/click/start and does not block UI.
5. Regression check: quest completion + offline queue + social still stable.
