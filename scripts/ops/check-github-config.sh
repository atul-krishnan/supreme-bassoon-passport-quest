#!/usr/bin/env bash
set -euo pipefail

REQUIRED_SECRETS=(
  SUPABASE_ACCESS_TOKEN
  EAS_TOKEN
  STAGING_PROJECT_REF
  STAGING_DB_PASSWORD
  STAGING_SUPABASE_URL
  STAGING_SUPABASE_PUBLISHABLE_KEY
  STAGING_SUPABASE_SERVICE_ROLE_KEY
  PROD_PROJECT_REF
  PROD_DB_PASSWORD
  PROD_SUPABASE_URL
  PROD_SUPABASE_PUBLISHABLE_KEY
)

OPTIONAL_SECRETS=(
  SENTRY_DSN
  EAS_STAGING_PROJECT_ID
  EAS_PRODUCTION_PROJECT_ID
  EAS_STAGING_PROJECT_SLUG
  EAS_PRODUCTION_PROJECT_SLUG
  STAGING_SENTRY_DSN
  PROD_SENTRY_DSN
  STAGING_API_BASE_URL
  PROD_API_BASE_URL
  MAESTRO_APP_FILE
  STAGING_SMOKE_TEST_EMAIL
  STAGING_SMOKE_TEST_PASSWORD
  PROD_SMOKE_TEST_EMAIL
  PROD_SMOKE_TEST_PASSWORD
  PROD_SUPABASE_SERVICE_ROLE_KEY
)

REQUIRED_VARS=(
  STAGING_COMPLETION_P95_MS
  STAGING_NEARBY_P95_MS
  STAGING_OFFLINE_SYNC_SLA_PCT
  STAGING_CRASH_FREE_SESSIONS_PCT
)

OPTIONAL_VARS=(
  AUTO_SUBMIT_TESTFLIGHT
  ENABLE_STAGING_IOS_BUILD
)

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required (https://cli.github.com/)" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh is not authenticated. Run: gh auth login" >&2
  exit 1
fi

present_secrets="$(gh secret list --json name --jq '.[].name')"
present_vars="$(gh variable list --json name --jq '.[].name')"

contains() {
  local needle="$1"
  local haystack="$2"
  printf '%s\n' "$haystack" | grep -Fxq -- "$needle"
}

print_group() {
  local title="$1"
  shift
  local -a items=("$@")
  local missing=0

  echo "${title}:"
  local name
  for name in "${items[@]}"; do
    if [[ "$title" == *"Secrets"* ]]; then
      if contains "$name" "$present_secrets"; then
        echo "  [OK] $name"
      else
        echo "  [MISSING] $name"
        missing=$((missing + 1))
      fi
    else
      if contains "$name" "$present_vars"; then
        echo "  [OK] $name"
      else
        echo "  [MISSING] $name"
        missing=$((missing + 1))
      fi
    fi
  done

  echo "  Missing count: $missing"
  echo
}

print_group "Required Secrets" "${REQUIRED_SECRETS[@]}"
print_group "Optional Secrets" "${OPTIONAL_SECRETS[@]}"
print_group "Required Variables" "${REQUIRED_VARS[@]}"
print_group "Optional Variables" "${OPTIONAL_VARS[@]}"
