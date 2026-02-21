# Product + Engineering Roadmap (v1.1 and v1.2)

Last updated: February 21, 2026
Owner: Passport Quest core team
Rollout strategy: India-first (`blr` production -> `del` -> `pune`), city-by-city KPI gates.

## 1. Scope summary

### v1.1 theme

Recommendation quality and trip intent personalization for Bangalore, without changing core gameplay trust model.

### v1.2 theme

Authenticity and social planning: verified reviews, group planning hooks, and redemption-ready ledger foundation.

## 2. v1.1 deliverables

### 2.1 User-facing features

- Session-based trip context capture (`solo/couple/family/friends` and time/pace/budget).
- Recommended quests list for active trip context.
- Quest intent tags shown in UI (`Family-safe`, `Date-friendly`, etc.).
- Mid-trip context adjustment.

### 2.2 Schema additions (exact)

1. `user_preferences`
- `user_id uuid pk`
- `interests_json jsonb`
- `pace_default text`
- `budget_default text`
- `preferred_time_windows_json jsonb`
- `mobility_prefs_json jsonb`
- `updated_at timestamptz`

2. `trip_context_sessions`
- `id uuid pk`
- `user_id uuid`
- `city_id text`
- `context_type text`
- `group_size integer`
- `with_kids boolean`
- `pace text`
- `budget text`
- `transport_mode text`
- `time_budget_min integer`
- `start_local timestamptz`
- `vibe_tags_json jsonb`
- `constraints_json jsonb`
- `status text`
- `created_at timestamptz`
- `updated_at timestamptz`

3. `quest_experience_tags`
- `quest_id uuid pk`
- `family_safe boolean`
- `date_friendly boolean`
- `kid_friendly boolean`
- `wheelchair_accessible boolean`
- `low_crowd boolean`
- `indoor_option boolean`
- `best_time_json jsonb`
- `safety_notes text`
- `updated_at timestamptz`

4. `recommendation_feedback`
- `id uuid pk`
- `user_id uuid`
- `trip_context_id uuid`
- `quest_id uuid`
- `feedback_type text`
- `metadata_json jsonb`
- `created_at timestamptz`

### 2.3 API additions (exact contracts)

1. `POST /v1/trips/context/start`

Request:

```json
{
  "cityId": "blr",
  "contextType": "couple",
  "groupSize": 2,
  "withKids": false,
  "pace": "balanced",
  "budget": "medium",
  "transportMode": "mixed",
  "timeBudgetMin": 180,
  "vibeTags": ["greenery", "quiet"],
  "constraints": {}
}
```

Response:

```json
{
  "tripContextId": "uuid",
  "status": "active",
  "cityId": "blr",
  "contextType": "couple"
}
```

2. `PATCH /v1/trips/context/{tripContextId}`

Request: partial update of pace/time/tags/constraints.

Response: updated context.

3. `POST /v1/trips/context/{tripContextId}/end`

Request:

```json
{ "status": "completed" }
```

Response:

```json
{ "tripContextId": "uuid", "status": "completed" }
```

4. `GET /v1/quests/recommended?cityId={cityId}&tripContextId={uuid}&limit={number}`

Response includes `whyRecommended[]` and tag flags.

5. `POST /v1/recommendations/feedback`

Request:

```json
{
  "tripContextId": "uuid",
  "questId": "uuid",
  "feedbackType": "opened",
  "metadata": { "rank": 1 }
}
```

Response:

```json
{ "status": "recorded" }
```

### 2.4 Analytics events (stable taxonomy)

- `trip_context_started`
- `trip_context_updated`
- `trip_context_ended`
- `recommended_quest_impression`
- `recommended_quest_opened`
- `recommended_quest_started`
- `recommended_quest_completed`

### 2.5 KPIs for v1.1 success

- +15% increase in quest start rate from recommendations.
- +10% increase in first-session completion depth for visitors.
- No regression on completion API p95 and offline sync SLA.

## 3. v1.2 deliverables

### 3.1 User-facing features

- Verified reviews on places/quests (only after accepted completion).
- Helpful/not-helpful votes.
- Review-based ranking boost in recommendations.
- Friend-planning starter (share a trip context link/invite).
- Redemption foundation (non-public wallet and event ledger only).

### 3.2 Schema additions (exact)

1. `quest_reviews`
- `id uuid pk`
- `user_id uuid`
- `quest_id uuid`
- `completion_id uuid`
- `rating integer`
- `review_text text`
- `tags_json jsonb`
- `language_code text`
- `status text`
- `helpful_count integer`
- `created_at timestamptz`
- `updated_at timestamptz`

Constraints:

- one verified review per user per quest per 30-day window.
- `rating between 1 and 5`.
- `status in ('active','hidden','flagged')`.

2. `quest_review_votes`
- `user_id uuid`
- `review_id uuid`
- `vote text`
- `created_at timestamptz`
- primary key `(user_id, review_id)`

Constraint:

- `vote in ('helpful','not_helpful')`.

3. `reward_ledger` (foundation only)
- `id uuid pk`
- `user_id uuid`
- `entry_type text`
- `xp_delta integer`
- `points_delta integer`
- `reference_type text`
- `reference_id text`
- `metadata_json jsonb`
- `created_at timestamptz`

Constraints:

- immutable append-only table.
- `entry_type in ('quest_reward','badge_bonus','manual_adjustment','redemption_hold','redemption_release')`.

### 3.3 API additions (exact contracts)

1. `POST /v1/reviews/quests`

Request:

```json
{
  "questId": "uuid",
  "completionId": "uuid",
  "rating": 5,
  "reviewText": "Great place for a peaceful morning walk.",
  "tags": ["family_safe", "clean", "easy_parking"],
  "languageCode": "en"
}
```

Response:

```json
{
  "reviewId": "uuid",
  "status": "active"
}
```

2. `GET /v1/reviews/quests?questId={uuid}&limit={n}&cursor={s}`

Response includes review summary, rating, tags, helpful count.

3. `POST /v1/reviews/{reviewId}/vote`

Request:

```json
{ "vote": "helpful" }
```

Response:

```json
{ "status": "recorded" }
```

4. `GET /v1/users/me/rewards/summary`

Response:

```json
{
  "xpTotal": 2400,
  "pointsBalance": 0,
  "ledgerVersion": 1
}
```

5. `GET /v1/users/me/rewards/ledger?limit={n}&cursor={s}`

Response: append-only ledger entries.

### 3.4 KPIs for v1.2 success

- >=25% of accepted completions produce verified reviews.
- Review abuse/flag rate <=2% of submitted reviews.
- Recommendation CTR uplift from review-weighted ranking >=8%.

## 4. Sequencing and release gates

### 4.1 Recommended sequencing

1. Ship v1.1 in Bangalore and stabilize for 2 weeks.
2. If KPI gate passes, activate Delhi content + runtime config.
3. Run same gate in Delhi, then activate Pune.
4. Launch v1.2 only after two-city stability.

### 4.2 Gate invariants (carry forward)

- completion p95 < 2s
- offline sync >=99% within 10 minutes
- duplicate reward rate = 0
- D2 treatment uplift >= +10%

## 5. Migration plan (additive-only)

- Release migrations in small slices per feature group.
- Never rename/remove v1 contract fields during MVP evolution.
- Add new endpoints first, switch client reads/writes behind flags, then deprecate old UX paths (not APIs).

## 6. Risks and mitigations

1. Risk: over-collection at onboarding.
- Mitigation: keep context capture to one lightweight sheet.

2. Risk: noisy recommendations.
- Mitigation: rule-based ranker with explicit `whyRecommended` explanations.

3. Risk: review spam.
- Mitigation: completion-gated reviews + one-per-window constraints + moderation flags.

## 7. Documentation linkage

- Trip context model: `/Users/atulkrishnan/Documents/Passport Quest/docs/trip-context-model.md`
- Architecture: `/Users/atulkrishnan/Documents/Passport Quest/docs/architecture.md`
- India expansion gate: `/Users/atulkrishnan/Documents/Passport Quest/docs/india-expansion-gate.md`
