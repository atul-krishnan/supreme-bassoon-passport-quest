# GitHub Actions Secrets and Vars Setup

Last updated: February 22, 2026

This checklist configures the workflows:

- `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/ci.yml`
- `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/main-to-staging.yml`
- `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/staging-gate.yml`
- `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/promote-to-prod.yml`

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

- `STAGING_API_BASE_URL` (defaults to `${STAGING_SUPABASE_URL}/functions/v1/v1`)
- `PROD_API_BASE_URL` (defaults to `${PROD_SUPABASE_URL}/functions/v1/v1`)
- `MAESTRO_APP_FILE` (if set, staging workflow runs Maestro smoke test with this app artifact)
- `STAGING_SMOKE_TEST_EMAIL` and `STAGING_SMOKE_TEST_PASSWORD` (only needed if anonymous auth and sign-up fallback are both unavailable in staging)
- `PROD_SMOKE_TEST_EMAIL` and `PROD_SMOKE_TEST_PASSWORD` (same purpose for production smoke checks)

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
```

## Repository variables

Required for `/Users/atulkrishnan/Documents/Passport Quest/.github/workflows/staging-gate.yml`:

- `STAGING_COMPLETION_P95_MS`
- `STAGING_NEARBY_P95_MS`
- `STAGING_OFFLINE_SYNC_SLA_PCT`
- `STAGING_CRASH_FREE_SESSIONS_PCT`

Optional:

- `AUTO_SUBMIT_TESTFLIGHT` (`true` to auto-submit after production build)

Example commands:

```bash
gh variable set STAGING_COMPLETION_P95_MS --body "1800"
gh variable set STAGING_NEARBY_P95_MS --body "650"
gh variable set STAGING_OFFLINE_SYNC_SLA_PCT --body "99.2"
gh variable set STAGING_CRASH_FREE_SESSIONS_PCT --body "99.7"
gh variable set AUTO_SUBMIT_TESTFLIGHT --body "false"
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
