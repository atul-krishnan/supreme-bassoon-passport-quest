# Testing, Environments, and Release Operations

Last updated: February 22, 2026

## Environment topology

| Environment | Backend | Mobile build | Primary purpose |
| --- | --- | --- | --- |
| Local | Supabase local stack | Expo dev client (`APP_ENV=local`) | Development, debugging, local contract checks |
| Staging | Supabase staging project (no branch) | EAS profile `staging` (`com.passportquest.mobile.staging`) | Release candidate validation |
| Production | Supabase production project | EAS profile `production` (`com.passportquest.mobile`) | TestFlight beta and production usage |

## Zero-cost pilot policy

For Bangalore pilot, keep infrastructure spend near zero:

1. Use a separate staging project, not Supabase branches.
2. Keep `STAGING_PROJECT_REF` and `PROD_PROJECT_REF` different.
3. Avoid adding paid observability/services until free-tier limits are actually hit.
4. Keep `AUTO_SUBMIT_TESTFLIGHT=false` by default.

Automation check:

```bash
npm run ops:check:zero-cost
```

## Required mobile env contract

- `APP_ENV` (`local|staging|production`)
- `API_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `POSTHOG_HOST`
- `POSTHOG_API_KEY`
- `SENTRY_DSN`
- `RELEASE_SHA`

Runtime parsing is defined in `/Users/atulkrishnan/Documents/Passport Quest/apps/mobile/src/config/env.ts` and supplied by `/Users/atulkrishnan/Documents/Passport Quest/apps/mobile/app.config.ts`.

## Guardrails

- Staging builds fail if they point to the production Supabase project URL.
- Every `v1` API response includes:
  - `x-request-id`
  - `x-release-sha`
- `GET /v1/health` is available for authenticated smoke checks.

## Automated checks

### Pull request (`PR Verify`)

Workflow file: `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/ci.yml`

Checks:

1. `npm ci`
2. `npm run mobile:typecheck`
3. `npm run mobile:test`
4. `npm run supabase:test`
5. `npm run contracts:smoke`

### Staging deployment

Workflow file: `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/main-to-staging.yml`

Sequence:

1. Push migrations to staging DB.
2. Deploy `v1` Edge Function.
3. Run API smoke checks (`/health`, bootstrap, summary).
4. Optionally build iOS staging artifact (`eas build --profile staging`) only when repo variable `ENABLE_STAGING_IOS_BUILD=true`.
5. Optionally run Maestro smoke suite.

### Staging gates

Workflow file: `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/staging-gate.yml`

Gate script:

- `/Users/atulkrishnan/Documents/Passport Quest/scripts/gates/staging-gate-check.mjs`

Thresholds:

- completion p95 `< 2000ms`
- nearby p95 `< 800ms`
- offline sync SLA `>= 99%`
- crash-free sessions `>= 99.5%`
- duplicate accepted completions `= 0`

Metric source behavior:

1. completion/nearby p95 are auto-derived from `public.api_request_metrics` over a rolling window.
2. if auto samples are below threshold, gate falls back to `STAGING_COMPLETION_P95_MS` / `STAGING_NEARBY_P95_MS`.
3. offline sync SLA and crash-free sessions are provided via staging variables.

### Android nightly smoke

Workflow file: `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/android-nightly-smoke.yml`

Sequence:

1. Run staging API smoke contracts.
2. If `ENABLE_ANDROID_NIGHTLY_SMOKE=true`, download APK from `MAESTRO_ANDROID_APP_URL`.
3. Start Android emulator and execute `.maestro/android-smoke.yaml`.

### Android staging APK build (manual)

Workflow file: `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/build-android-staging-apk.yml`

Sequence:

1. Validate zero-cost policy and staging build secrets.
2. Build Android staging artifact via EAS (`staging` profile with `buildType=apk`).
3. Publish APK and build details links in workflow summary.

### Production promotion

Workflow file: `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/promote-to-prod.yml`

Sequence:

1. Apply production migrations.
2. Deploy production `v1` function.
3. Run production API smoke checks.
4. Build production iOS artifact.
5. Optional TestFlight submit.

### Production backend-only release (no iOS/TestFlight)

Workflow file: `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/prod-backend-release.yml`

Sequence:

1. Apply production migrations.
2. Deploy production `v1` function.
3. Run production API smoke checks.

### Production smoke dry run (no deploy/build)

Workflow file: `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/prod-smoke-dry-run.yml`

Sequence:

1. Validate zero-cost policy and production smoke secrets.
2. Execute production `v1` smoke contracts (`/health`, bootstrap, summary).
3. Skip migrations, function deploy, iOS build, and TestFlight submission.

## Mobile QA mode

Visible only in non-production builds from Profile tab.

Capabilities:

1. Force sync offline queue.
2. Clear local offline queue.
3. Enable/disable Bangalore test location override.
4. Reset and re-bootstrap session.
5. Display runtime metadata (env, release, user, city, experiment, queue).

## Maestro smoke suites

Flows:

- `/Users/atulkrishnan/Documents/Passport Quest/.maestro/ios-smoke.yaml`
- `/Users/atulkrishnan/Documents/Passport Quest/.maestro/android-smoke.yaml`

Run:

```bash
npm run maestro:ios:smoke
npm run maestro:android:smoke
```

## UAT evidence

For each staging candidate attach:

1. Build identifier and release SHA.
2. QA checklist pass/fail notes.
3. Screenshots for onboarding, quest completion, offline replay, social flow.
4. KPI snapshot for latency/SLA/duplicates.

Template command:

```bash
npm run ops:uat:evidence -- --release-sha=<commit_sha> --build-id=<build_identifier> --author="<name>"
```

Evidence folder guide:

- `/Users/atulkrishnan/Documents/Passport Quest/docs/uat-evidence/README.md`

## Smoke user setup

To provision/update stable password-based smoke users and sync credentials to GitHub secrets:

```bash
npm run ops:setup:smoke-users
```

Script:

- `/Users/atulkrishnan/Documents/Passport Quest/scripts/ops/setup-smoke-users.mjs`
