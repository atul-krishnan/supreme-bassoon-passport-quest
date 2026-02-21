# Performance Checks (Bangalore Gate)

## Completion latency (target p95 < 2s)

- Measure Edge Function latency for `POST /v1/quests/complete` from app telemetry event `quest_completion_api_latency`.
- Compute p95 over rolling 24h and weekly windows.

## Nearby query latency (target warm p95 < 800ms)

- Measure client timing around `GET /v1/quests/nearby` after initial app bootstrap.
- Segment by network type (wifi/cellular).

## Offline sync SLA (target >=99% within 10 minutes)

- Track queue age minutes when `offline_sync_success` fires.
- KPI: percent of queued events synced with age <= 10 minutes.

## Suggested SQL probes (server side)

```sql
-- Duplicate reward integrity
select count(*) as duplicate_accepted
from public.quest_completions qc
where qc.status = 'accepted'
and exists (
  select 1
  from public.quest_completions q2
  where q2.user_id = qc.user_id
    and q2.device_event_id = qc.device_event_id
    and q2.id <> qc.id
    and q2.status = 'accepted'
);

-- Recent completion volume and rejection rate
select
  date_trunc('hour', received_at) as hour,
  count(*) as attempts,
  count(*) filter (where status = 'accepted') as accepted,
  count(*) filter (where status = 'rejected') as rejected
from public.quest_completions
where received_at >= now() - interval '24 hours'
group by 1
order by 1 desc;
```
