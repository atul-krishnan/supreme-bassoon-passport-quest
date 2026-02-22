# Workflow Operator Guide

Last updated: February 22, 2026

This is the quick decision guide for when to run each GitHub Actions workflow.

## Core principle

For pilot mode, keep build/deploy frequency low and intentional:

1. Code confidence is automatic (`PR Verify`).
2. Staging backend validation is automatic/manual (`Main To Staging`, `Staging Gate`).
3. Mobile build creation is manual and explicit (`Build Android Staging APK` with confirmation input).
4. Production changes are manual and protected (`production` environment).

## Workflow map

| Workflow | Trigger | What it does | When to use | Cost/risk |
| --- | --- | --- | --- | --- |
| `PR Verify` | push + PR | local Supabase reset, mobile tests, DB tests, API smoke | every code change | low infra cost, high confidence |
| `Main To Staging` | push to `main` + manual | staging migrations + function deploy + staging API smoke | after merging code to `main` | low-medium, backend mutation |
| `Staging Gate` | schedule + manual | KPI gate checks (latency/SLA/duplicates/crash-free) | daily and before release decision | low |
| `Build Android Staging APK` | manual only | EAS Android APK build for staging + publish links | only when you want installable app binary | medium build minutes |
| `Android Nightly Smoke` | schedule + manual | optional emulator smoke using external APK URL | enable later once APK URL automation is stable | medium |
| `Production Backend Release` | manual only | prod migrations + function deploy + prod smoke | backend-only production rollout | high, production mutation |
| `Production Smoke Dry Run` | manual only | prod smoke checks without deploy/build | verify prod health any time | low |
| `Promote To Production` | manual only | full prod path: migrations + functions + iOS build (+optional submit) | only when iOS/TestFlight release is intended | highest |

## Android-first pilot mode

Recommended toggles:

- `ENABLE_STAGING_IOS_BUILD=false`
- `ENABLE_ANDROID_NIGHTLY_SMOKE=false` (until you intentionally enable nightly emulator checks)
- `AUTO_SUBMIT_TESTFLIGHT=false`

APK build safety:

- `Build Android Staging APK` requires workflow input `confirm_build=BUILD_NOW`.
- If input is not exact, workflow exits before build steps.

## Minimal weekly routine (Android-first)

1. Merge planned work to `main`.
2. Confirm `PR Verify` + `Main To Staging` success.
3. Run `Staging Gate`.
4. If team needs installable app, manually run `Build Android Staging APK` with `confirm_build=BUILD_NOW`.
5. Execute scripted UAT and store evidence.

## Do not run unless needed

- `Promote To Production`: skip until iOS/TestFlight phase.
- `Production Backend Release`: run only for intentional production backend changes.
- `Android Nightly Smoke`: keep off unless you have stable APK distribution path and clear need.
