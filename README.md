# Passport Quest

FlowState v1 implementation scaffold (decision-first execution assistant) using Expo React Native + Supabase.

## What is implemented

- Mobile app scaffold (`apps/mobile`) with:
- Anonymous guest auth bootstrap (Supabase Auth).
- FlowState diagnostic onboarding (energy, focus pillar, friction).
- Instant Play home with single hero play card and execution CTA.
- Active play script screen with step timer and XP reward loop.
- Profile screen focused on decisions saved, plays completed, and planning hours saved.
- Shared API/contracts package (`packages/shared`).
- Supabase schema + RLS + city runtime config (`supabase/migrations`).
- Supabase Edge Function router implementing v1 endpoints (`supabase/functions/v1`).
- SQL tests focused on core + FlowState contracts (`supabase/tests`).

## Repo layout

- `/Users/atulkrishnan/Documents/Passport Quest/apps/mobile`
- `/Users/atulkrishnan/Documents/Passport Quest/packages/shared`
- `/Users/atulkrishnan/Documents/Passport Quest/supabase/migrations`
- `/Users/atulkrishnan/Documents/Passport Quest/supabase/functions/v1`
- `/Users/atulkrishnan/Documents/Passport Quest/docs`

## API routes implemented

All routes are served by the Supabase Edge Function `v1` and map to:

- `POST /v1/flowstate/diagnostic`
- `GET /v1/flowstate/play/hero?cityId={cityId?}`
- `POST /v1/flowstate/play/start`
- `GET /v1/flowstate/play/sessions/{sessionId}`
- `POST /v1/flowstate/play/sessions/{sessionId}/steps/{stepOrder}/done`
- `GET /v1/flowstate/summary`
- `GET /v1/config/bootstrap?cityId={cityId}`
- `GET /v1/users/me/summary`
- `PATCH /v1/users/me/profile`
- `POST /v1/notifications/register-token`
- `GET /v1/health`

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

5. Configure mobile runtime env.

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
```

Minimum local values:

- `APP_ENV=local`
- `API_BASE_URL=http://127.0.0.1:54321/functions/v1/v1`
- `SUPABASE_URL=http://127.0.0.1:54321`
- `SUPABASE_PUBLISHABLE_KEY=<local anon/publishable key>`

6. Start mobile app.

```bash
npm run mobile:start
```

Android dev-client (recommended to avoid Metro script-load failures):

```bash
npm run mobile:android:stable
```

If Android shows `Unable to load script`, run:

```bash
adb reverse tcp:8081 tcp:8081
npm run mobile:start -- --dev-client --clear --port 8081
```

7. Optional status check.

```bash
npm run local:status
```

## Rollout strategy

- Bangalore (`blr`) is the only production pilot city in MVP v1.
- Delhi (`del`) and Pune (`pune`) are post-BLR gate rollout cities.
- NYC staging compatibility is retained in backend contracts only.

## Notes

- FlowState execution and rewards are server-trusted via dedicated `play_*` RPCs.
- Quiet hours, feature flags, and experiment variant resolution flow through bootstrap/runtime config.

## Architecture docs

- Architecture overview: `/Users/atulkrishnan/Documents/Passport Quest/docs/architecture.md`
- ADR process: `/Users/atulkrishnan/Documents/Passport Quest/docs/adr/README.md`
- ADR template: `/Users/atulkrishnan/Documents/Passport Quest/docs/adr/0000-template.md`
- India rollout gate: `/Users/atulkrishnan/Documents/Passport Quest/docs/india-expansion-gate.md`
- FlowState QA checklist: `/Users/atulkrishnan/Documents/Passport Quest/docs/qa-checklist-bangalore.md`
- v1.1/v1.2 roadmap: `/Users/atulkrishnan/Documents/Passport Quest/docs/roadmap-v1.1-v1.2.md`
- Testing + environments + release: `/Users/atulkrishnan/Documents/Passport Quest/docs/testing-environments-and-release.md`
- GitHub Actions secrets setup: `/Users/atulkrishnan/Documents/Passport Quest/docs/github-actions-secrets-setup.md`
- Engineering operating rules: `/Users/atulkrishnan/Documents/Passport Quest/docs/engineering-operating-rules.md`
- Observability playbook (Sentry + PostHog): `/Users/atulkrishnan/Documents/Passport Quest/docs/observability-playbook.md`

## Next recommended steps

- Add DEL/PUNE post-gate migration slice and city content packs.
- Add push nudge scheduler worker and KPI alerting automation.
- Add deeper load tests for FlowState hero/start/step latency SLOs.
