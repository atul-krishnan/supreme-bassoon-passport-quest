# FlowState Diagnostic + Play Model

Last updated: February 27, 2026

## Objective

Represent user execution context with the minimum data needed to:

1. pick one high-confidence hero play,
2. guide step-by-step execution,
3. quantify decisions saved and planning time saved.

## Diagnostic model

### Input dimensions

1. `energyBaseline`: `low | balanced | high`
2. `focusPillar`: `deep_work | vitality_health | local_discovery`
3. `frictionPoint`: `decision_paralysis | procrastination`

### Persistence

- Table: `user_flow_diagnostics`
- One current diagnostic state per user.
- Updated via `upsert_user_flow_diagnostic`.

## Play recommendation model

### Core entities

1. `play_templates`
2. `play_template_steps`
3. `play_recommendations`

### Output contract

- `get_hero_play(user_id, city_id?)` returns:
  - `status: ready | diagnostic_required`
  - one `heroPlay` payload when ready

## Execution model

### Session entities

1. `play_sessions`
2. `play_session_steps`

### Runtime behavior

1. `start_play_session` creates an in-progress session from recommendation.
2. `get_play_session_detail` returns current script state.
3. `mark_play_step_done` advances state and finalizes reward on completion.

## Achievement model

### Aggregate metrics

Stored in `user_stats` and exposed via `get_flowstate_summary`:

1. `xp_total`
2. `level`
3. `plays_completed`
4. `decisions_saved`
5. `planning_minutes_saved`

## Guardrails

1. Keep city context optional and data-driven.
2. Keep recommendation output to a single hero play for default UX.
3. Never block step progression on non-critical telemetry failure.
4. Keep contracts additive for backward compatibility within `v1`.
