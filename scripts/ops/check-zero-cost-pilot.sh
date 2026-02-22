#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

fail() {
  echo "[zero-cost-check] $1" >&2
  exit 1
}

info() {
  echo "[zero-cost-check] $1"
}

# 1) Disallow Supabase branch-management usage in automation.
if rg -n "supabase.*branch|create_branch|merge_branch|rebase_branch|reset_branch|list_branches|branch_id" \
  "$ROOT_DIR/.github/workflows" "$ROOT_DIR/scripts/contracts" "$ROOT_DIR/scripts/gates" >/tmp/pq-zero-cost-matches.txt 2>/dev/null; then
  echo "[zero-cost-check] Found branch-related automation references:" >&2
  cat /tmp/pq-zero-cost-matches.txt >&2
  fail "Supabase branch automation is disabled for zero-cost pilot"
fi

# 2) If env refs are available, enforce dedicated staging project (not production project).
STAGING_PROJECT_REF="${STAGING_PROJECT_REF:-}"
PROD_PROJECT_REF="${PROD_PROJECT_REF:-}"

if [[ -n "$STAGING_PROJECT_REF" && -n "$PROD_PROJECT_REF" ]]; then
  if [[ "$STAGING_PROJECT_REF" == "$PROD_PROJECT_REF" ]]; then
    fail "STAGING_PROJECT_REF must differ from PROD_PROJECT_REF for safe low-cost rollout"
  fi
  info "Project ref separation check passed"
else
  info "Project ref separation check skipped (env not provided)"
fi

# 3) Confirm optional expensive paths are off by default.
AUTO_SUBMIT_TESTFLIGHT="${AUTO_SUBMIT_TESTFLIGHT:-false}"
if [[ "$AUTO_SUBMIT_TESTFLIGHT" == "true" ]]; then
  info "AUTO_SUBMIT_TESTFLIGHT=true (allowed, but review App Store workflow usage)"
else
  info "AUTO_SUBMIT_TESTFLIGHT default is cost-safe"
fi

info "Zero-cost pilot policy checks passed"
