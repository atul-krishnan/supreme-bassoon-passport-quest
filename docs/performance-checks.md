# Performance Checks (FlowState)

## Hero play latency (target p95 < 800ms)

- Measure Edge Function latency for `GET /v1/flowstate/play/hero`.
- Compute p95 over rolling 24h and weekly windows.
- Segment by city context and network type.

## Play-start latency (target p95 < 1200ms)

- Measure `POST /v1/flowstate/play/start` from tap to response.
- Track failure rate for `recommendation_not_found` and transport errors.

## Step completion latency (target p95 < 1200ms)

- Measure `POST /v1/flowstate/play/sessions/{id}/steps/{n}/done`.
- Verify no duplicate XP award on retried requests.

## State summary latency (target p95 < 700ms)

- Measure `GET /v1/flowstate/summary` used by profile.
- Validate profile render remains stable on slow network.

## Suggested SQL probes (server side)

```sql
-- Completed sessions in last 24h
select count(*) as completed_sessions_24h
from public.play_sessions
where status = 'completed'
  and completed_at >= now() - interval '24 hours';

-- Step completion volume by status in last 24h
select
  status,
  count(*) as steps
from public.play_session_steps
where updated_at >= now() - interval '24 hours'
group by status
order by status;

-- Users with non-zero planning minutes saved
select count(*) as users_with_saved_minutes
from public.user_stats
where planning_minutes_saved > 0;
```
