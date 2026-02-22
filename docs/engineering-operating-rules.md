# Engineering Operating Rules

Last updated: February 22, 2026

This document defines the working agreement for Passport Quest engineering (lean startup mode, high execution speed, low regression tolerance).

## Core standards

1. `main` is always releasable.
2. No direct pushes to `main`; merge by PR only.
3. One PR should address one concern.
4. If a check takes long, continue other independent tasks in parallel.
5. Production changes require manual approval and explicit rollback intent.

## Branching policy

Use short-lived branches:

- `feature/<topic>`
- `fix/<topic>`
- `chore/<topic>`
- `hotfix/<topic>`
- `codex/<topic>` (automation/agent branches)

Rules:

1. Branch from latest `main`.
2. Rebase or merge `main` at least once daily for multi-day work.
3. Delete branch after merge.

## Commit policy

Commit by logical unit, not by end-of-day dump.

Rules:

1. Commit when code compiles/tests for that unit.
2. Commit before context switching.
3. Keep message format: `type(scope): summary`.
4. Do not mix unrelated concerns in a single commit.

Examples:

- `feat(quests): add recommended quest impression event`
- `fix(auth): retry failed refresh once before logout`
- `ci(android): harden emulator smoke startup timeout`

## Pull request policy

PRs must be reviewable and testable.

Rules:

1. Open PR early (draft is fine), update continuously.
2. Target PR size under 600 changed lines; split large work.
3. Fill PR template completely.
4. Attach test evidence and run links for CI/workflow-impacting changes.
5. At least one approval required before merge.

## CI and workflow policy

Reference guide:

- `/Users/atulkrishnan/Documents/Passport Quest/docs/workflow-operator-guide.md`

Rules:

1. `PR Verify` must pass before merge.
2. `Main To Staging` validates backend deploy path after merge to `main`.
3. `Build Android Staging APK` is manual-only, run only when installable build is needed.
4. `Android Nightly Smoke` stays manual unless explicitly enabled.
5. `Promote To Production` is manual and approval-gated only.

## Environment and release policy

1. Staging and production must use separate Supabase projects.
2. No production credentials in code or local committed files.
3. Use additive migrations by default.
4. For hotfixes, ship fast then backport to normal branch flow within 24 hours.

## Definition of done

A change is done only if all apply:

1. Code merged via PR and CI green.
2. Required tests run and evidence attached.
3. Docs updated when behavior or operations changed.
4. Rollback path is known.
5. No open severity-1 regressions from the change.

## Weekly operating cadence (2-4 engineer team)

1. Monday: plan slices and risk hotspots.
2. Daily: small PRs, staged validation, no long-lived hidden work.
3. Mid-week: one Android staging build + scripted UAT as needed.
4. Friday: release readiness review against runbooks/KPIs.
