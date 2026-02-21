# Trip Context Model (Session-Based, Profile-Clean)

Last updated: February 21, 2026

## 1. Objective

Enable personalized recommendations without polluting core user profile.

Principle:

- Keep personal identity in `profiles`.
- Keep long-lived taste signals in separate preference tables.
- Keep trip intent (solo/date/family/friends, pace, time budget) as session context.

## 2. Why this model

A single user can have different intents on different days:

- solo on weekday evening
- couple/date on Friday night
- family on Sunday morning

So group context must be trip-level, not user identity.

## 3. Data model (exact fields)

### 3.1 Persistent preferences (optional, low-frequency updates)

Table: `user_preferences`

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `interests_json jsonb not null default '[]'::jsonb`
- `pace_default text not null default 'balanced'`
- `budget_default text not null default 'medium'`
- `preferred_time_windows_json jsonb not null default '[]'::jsonb`
- `mobility_prefs_json jsonb not null default '{}'::jsonb`
- `updated_at timestamptz not null default now()`

Checks:

- `pace_default in ('relaxed','balanced','active')`
- `budget_default in ('low','medium','high')`

### 3.2 Trip/session context (primary personalization driver)

Table: `trip_context_sessions`

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `city_id text not null references cities(id)`
- `context_type text not null`
- `group_size integer not null default 1`
- `with_kids boolean not null default false`
- `pace text not null default 'balanced'`
- `budget text not null default 'medium'`
- `transport_mode text not null default 'mixed'`
- `time_budget_min integer not null`
- `start_local timestamptz`
- `vibe_tags_json jsonb not null default '[]'::jsonb`
- `constraints_json jsonb not null default '{}'::jsonb`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Checks:

- `context_type in ('solo','couple','family','friends')`
- `pace in ('relaxed','balanced','active')`
- `budget in ('low','medium','high')`
- `transport_mode in ('walk','public_transit','bike','car','mixed')`
- `time_budget_min between 30 and 720`
- `status in ('active','completed','cancelled')`

Indexes:

- `(user_id, created_at desc)`
- `(city_id, created_at desc)`
- partial index `(user_id) where status = 'active'`

### 3.3 Content safety/intent tags on places/quests

Table: `quest_experience_tags`

- `quest_id uuid primary key references quests(id) on delete cascade`
- `family_safe boolean not null default false`
- `date_friendly boolean not null default false`
- `kid_friendly boolean not null default false`
- `wheelchair_accessible boolean not null default false`
- `low_crowd boolean not null default false`
- `indoor_option boolean not null default false`
- `best_time_json jsonb not null default '[]'::jsonb`
- `safety_notes text`
- `updated_at timestamptz not null default now()`

### 3.4 Recommendation feedback (training signal)

Table: `recommendation_feedback`

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `trip_context_id uuid references trip_context_sessions(id) on delete set null`
- `quest_id uuid not null references quests(id) on delete cascade`
- `feedback_type text not null`
- `metadata_json jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Checks:

- `feedback_type in ('shown','opened','started','completed','dismissed','saved')`

## 4. RLS rules (recommended)

- `user_preferences`: select/update only `auth.uid() = user_id`.
- `trip_context_sessions`: select/insert/update only `auth.uid() = user_id`.
- `recommendation_feedback`: select/insert only `auth.uid() = user_id`.
- `quest_experience_tags`: read allowed for authenticated; write service role only.

## 5. API contracts (additive)

### 5.1 Start trip context

`POST /v1/trips/context/start`

Request:

```json
{
  "cityId": "blr",
  "contextType": "family",
  "groupSize": 3,
  "withKids": true,
  "pace": "relaxed",
  "budget": "medium",
  "transportMode": "car",
  "timeBudgetMin": 180,
  "startLocal": "2026-02-22T09:00:00+05:30",
  "vibeTags": ["greenery", "quiet"],
  "constraints": {
    "avoidStairs": true,
    "needsWashroom": true
  }
}
```

Response:

```json
{
  "tripContextId": "uuid",
  "status": "active",
  "cityId": "blr",
  "contextType": "family",
  "createdAt": "2026-02-21T11:00:00Z"
}
```

### 5.2 Update active trip context

`PATCH /v1/trips/context/{tripContextId}`

Request (partial):

```json
{
  "pace": "active",
  "timeBudgetMin": 120,
  "vibeTags": ["food", "street-life"]
}
```

Response: updated context object.

### 5.3 End trip context

`POST /v1/trips/context/{tripContextId}/end`

Request:

```json
{
  "status": "completed"
}
```

Response:

```json
{
  "tripContextId": "uuid",
  "status": "completed"
}
```

### 5.4 Get recommended quests for context

`GET /v1/quests/recommended?cityId={cityId}&tripContextId={uuid}&limit={number}`

Response:

```json
{
  "tripContextId": "uuid",
  "cityId": "blr",
  "quests": [
    {
      "id": "uuid",
      "title": "Cubbon Park Morning Walk",
      "xpReward": 100,
      "tags": {
        "familySafe": true,
        "dateFriendly": false
      },
      "whyRecommended": [
        "matches relaxed pace",
        "family-safe and kid-friendly",
        "within 20 minutes"
      ]
    }
  ]
}
```

### 5.5 Submit recommendation feedback

`POST /v1/recommendations/feedback`

Request:

```json
{
  "tripContextId": "uuid",
  "questId": "uuid",
  "feedbackType": "opened",
  "metadata": {
    "rank": 2,
    "source": "recommended_carousel"
  }
}
```

Response:

```json
{
  "status": "recorded"
}
```

## 6. UI copy (exact strings)

### 6.1 Start context sheet

- Title: `Plan this outing`
- Subtitle: `Tell us this trip context. Your account stays personal.`
- Field label: `Who are you exploring with?`
- Options: `Solo`, `Couple`, `Family`, `Friends`
- Field label: `How much time do you have?`
- Options: `1 hour`, `2 hours`, `Half day`, `Full day`
- Field label: `Preferred pace`
- Options: `Relaxed`, `Balanced`, `Active`
- CTA: `Start Plan`

### 6.2 Recommendation ribbon copy

- Header: `Picked for this outing`
- Helper: `Based on your current trip context.`

### 6.3 Tag semantics copy

- `Family-safe` helper: `Generally suitable for families: safer route, easier access, and kid-friendly environment.`
- `Date-friendly` helper: `Great for couples: ambience, walkability, and quality conversation spots.`
- Safety disclaimer: `Context tags are guidance, not guarantees. Please use your judgement on-ground.`

### 6.4 Mid-trip adjust copy

- CTA: `Adjust Plan`
- Modal title: `Update this outing`
- Success toast: `Plan updated. Recommendations refreshed.`

## 7. Recommendation logic (v1.1 rule-based)

Initial score formula:

- `score = distance_score + context_match_score + quality_score + freshness_score`

Components:

- distance score: closer quests rank higher.
- context match: boost for matching tags (`family_safe`, `date_friendly`, etc.).
- quality score: completion success rate and verified ratings later.
- freshness score: recently curated/active quests gain mild boost.

## 8. Future ML seam (v1.2+)

- Keep `recommendation_feedback` and completion logs as supervised signals.
- Train city-specific ranker after enough volume.
- Keep fallback rule-based ranker active for cold start.
