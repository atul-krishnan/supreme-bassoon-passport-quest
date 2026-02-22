# GitHub Actions Secrets and Vars Setup

Last updated: February 22, 2026

This checklist configures the workflows:

- `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/ci.yml`
- `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/main-to-staging.yml`
- `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/android-nightly-smoke.yml`
- `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/staging-gate.yml`
- `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/promote-to-prod.yml`
- `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/prod-smoke-dry-run.yml`

## Prerequisites

1. `gh auth login`
2. `gh repo set-default atulkrishnan/passport-quest` (replace with your repo)
3. Supabase access token with project management permissions
4. EAS token for build/submit workflows

Policy: Bangalore pilot uses two projects (`staging`, `production`) and does not use Supabase branches.

## Repository secrets

Required:

- `SUPABASE_ACCESS_TOKEN`
- `EAS_TOKEN`
- `STAGING_PROJECT_REF`
- `STAGING_DB_PASSWORD`
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_PUBLISHABLE_KEY`
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`
- `PROD_PROJECT_REF`
- `PROD_DB_PASSWORD`
- `PROD_SUPABASE_URL`
- `PROD_SUPABASE_PUBLISHABLE_KEY`

Optional:

- `SENTRY_DSN` (single shared DSN fallback used by both staging and production workflows)
- `EAS_STAGING_PROJECT_ID` (required to run staging EAS build step in CI; if missing, staging workflow skips iOS build)
- `EAS_PRODUCTION_PROJECT_ID` (required for production promotion workflow iOS build step)
- `EAS_STAGING_PROJECT_SLUG` (optional override if staging project slug is not `passport-quest-staging`)
- `EAS_PRODUCTION_PROJECT_SLUG` (optional override if production project slug is not `passport-quest`)
- `STAGING_SENTRY_DSN` (optional override for staging; if absent, workflow falls back to `SENTRY_DSN`)
- `PROD_SENTRY_DSN` (optional override for production; if absent, workflow falls back to `SENTRY_DSN`)
- `STAGING_API_BASE_URL` (defaults to `${STAGING_SUPABASE_URL}/functions/v1/v1`)
- `PROD_API_BASE_URL` (defaults to `${PROD_SUPABASE_URL}/functions/v1/v1`)
- `MAESTRO_APP_FILE` (if set, staging workflow runs Maestro smoke test with this app artifact)
- `MAESTRO_ANDROID_APP_URL` (HTTPS URL to a staging Android APK for nightly Maestro smoke)
- `STAGING_SMOKE_TEST_EMAIL` and `STAGING_SMOKE_TEST_PASSWORD` (optional explicit test user creds for staging smoke checks)
- `PROD_SMOKE_TEST_EMAIL` and `PROD_SMOKE_TEST_PASSWORD` (optional explicit test user creds for production smoke checks)
- `PROD_SUPABASE_SERVICE_ROLE_KEY` (recommended so production smoke checks can auto-provision an ephemeral confirmed user when anonymous auth is disabled)

Note: staging iOS build is disabled by default for lean pilot mode. Set `ENABLE_STAGING_IOS_BUILD=true` (repository variable) only when you are ready to enforce iOS CI builds.

Quick audit command:

```bash
npm run ops:check:github-config
npm run ops:check:zero-cost
```

Example commands:

```bash
gh secret set SUPABASE_ACCESS_TOKEN --body "$SUPABASE_ACCESS_TOKEN"
gh secret set EAS_TOKEN --body "$EAS_TOKEN"
gh secret set STAGING_PROJECT_REF --body "your-staging-project-ref"
gh secret set STAGING_DB_PASSWORD --body "your-staging-db-password"
gh secret set STAGING_SUPABASE_URL --body "https://your-staging-ref.supabase.co"
gh secret set STAGING_SUPABASE_PUBLISHABLE_KEY --body "sb_publishable_xxx"
gh secret set STAGING_SUPABASE_SERVICE_ROLE_KEY --body "service_role_xxx"
gh secret set PROD_PROJECT_REF --body "your-prod-project-ref"
gh secret set PROD_DB_PASSWORD --body "your-prod-db-password"
gh secret set PROD_SUPABASE_URL --body "https://your-prod-ref.supabase.co"
gh secret set PROD_SUPABASE_PUBLISHABLE_KEY --body "sb_publishable_xxx"
```

Optional:

```bash
gh secret set STAGING_API_BASE_URL --body "https://your-staging-ref.supabase.co/functions/v1/v1"
gh secret set PROD_API_BASE_URL --body "https://your-prod-ref.supabase.co/functions/v1/v1"
gh secret set MAESTRO_APP_FILE --body "/path/to/staging-app.apk-or.ipa"
gh secret set MAESTRO_ANDROID_APP_URL --body "https://example.com/path/to/staging.apk"
gh secret set SENTRY_DSN --body "https://<key>@<org>.ingest.sentry.io/<id>"
gh secret set EAS_STAGING_PROJECT_ID --body "your-eas-staging-project-id"
gh secret set EAS_PRODUCTION_PROJECT_ID --body "your-eas-production-project-id"
gh secret set EAS_STAGING_PROJECT_SLUG --body "passport-quest-staging"
gh secret set EAS_PRODUCTION_PROJECT_SLUG --body "passport-quest"
gh secret set STAGING_SENTRY_DSN --body "https://<key>@<org>.ingest.sentry.io/<id>"
gh secret set PROD_SENTRY_DSN --body "https://<key>@<org>.ingest.sentry.io/<id>"
gh secret set STAGING_SMOKE_TEST_EMAIL --body "smoke-staging@example.com"
gh secret set STAGING_SMOKE_TEST_PASSWORD --body "set-a-strong-password"
gh secret set PROD_SMOKE_TEST_EMAIL --body "smoke-prod@example.com"
gh secret set PROD_SMOKE_TEST_PASSWORD --body "set-a-strong-password"
gh secret set PROD_SUPABASE_SERVICE_ROLE_KEY --body "service_role_xxx"
```

## Bootstrap smoke-test users (recommended)

Use this when you want stable password-based smoke auth for both environments without manual copy/paste.

1. Export required runtime env values in your shell:

```bash
export STAGING_SUPABASE_URL="https://<staging-ref>.supabase.co"
export STAGING_SUPABASE_SERVICE_ROLE_KEY="<staging-service-role>"
export STAGING_SUPABASE_PUBLISHABLE_KEY="<staging-publishable-key>"
export PROD_SUPABASE_URL="https://<prod-ref>.supabase.co"
export PROD_SUPABASE_SERVICE_ROLE_KEY="<prod-service-role>"
export PROD_SUPABASE_PUBLISHABLE_KEY="<prod-publishable-key>"
```

2. Run automated setup:

```bash
npm run ops:setup:smoke-users
```

Default behavior:
- Creates or updates `smoke-staging@passportquest.app` and `smoke-prod@passportquest.app`.
- Generates strong passwords if not provided.
- Verifies password login for each user.
- Updates GitHub secrets:
  - `STAGING_SMOKE_TEST_EMAIL`
  - `STAGING_SMOKE_TEST_PASSWORD`
  - `PROD_SMOKE_TEST_EMAIL`
  - `PROD_SMOKE_TEST_PASSWORD`

Target one environment only:

```bash
SMOKE_TARGET=staging npm run ops:setup:smoke-users
SMOKE_TARGET=production npm run ops:setup:smoke-users
```

Disable GitHub secret sync (manual mode):

```bash
SYNC_GITHUB_SECRETS=false \
STAGING_SMOKE_TEST_PASSWORD="<strong-password>" \
npm run ops:setup:smoke-users
```

If you need provisioning without login verification (for example, when email/password auth is intentionally disabled), set:

```bash
SMOKE_VERIFY_PASSWORD_LOGIN=false npm run ops:setup:smoke-users
```

## Repository variables

Required for `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/staging-gate.yml`:

- `STAGING_COMPLETION_P95_MS`
- `STAGING_NEARBY_P95_MS`
- `STAGING_OFFLINE_SYNC_SLA_PCT`
- `STAGING_CRASH_FREE_SESSIONS_PCT`

Optional:

- `AUTO_SUBMIT_TESTFLIGHT` (`true` to auto-submit after production build)
- `ENABLE_STAGING_IOS_BUILD` (`true` to enable staging iOS build step in `Main To Staging`; default `false`)
- `ENABLE_ANDROID_NIGHTLY_SMOKE` (`true` to enable Android nightly emulator + Maestro smoke run; default `false`)
- `AUTO_METRIC_WINDOW_HOURS` (staging gate auto-metric lookback window, default `24`)
- `AUTO_METRIC_MIN_SAMPLES` (minimum sample count for auto latency p95 before env fallback, default `30`)

Example commands:

```bash
gh variable set STAGING_COMPLETION_P95_MS --body "1800"
gh variable set STAGING_NEARBY_P95_MS --body "650"
gh variable set STAGING_OFFLINE_SYNC_SLA_PCT --body "99.2"
gh variable set STAGING_CRASH_FREE_SESSIONS_PCT --body "99.7"
gh variable set AUTO_SUBMIT_TESTFLIGHT --body "false"
gh variable set ENABLE_STAGING_IOS_BUILD --body "false"
gh variable set ENABLE_ANDROID_NIGHTLY_SMOKE --body "false"
gh variable set AUTO_METRIC_WINDOW_HOURS --body "24"
gh variable set AUTO_METRIC_MIN_SAMPLES --body "30"
```

## Environment protection rules

Production promotion uses `environment: production`.

Configure:

1. Required reviewers for production environment approval.
2. Optional wait timer and branch restrictions.

## One-time smoke validation

After setting secrets/vars:

1. Run `Main To Staging` via workflow dispatch.
2. Confirm staging deploy, smoke contracts, and build steps pass.
3. Run `Staging Gate` and confirm threshold evaluation passes.
4. Run `Promote To Production` from approved SHA.
