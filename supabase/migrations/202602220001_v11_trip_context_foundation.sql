-- Passport Quest MVP v1.1 backend foundation
-- Trip context and recommendation contracts (additive-only).

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  interests_json jsonb not null default '[]'::jsonb,
  pace_default text not null default 'balanced',
  budget_default text not null default 'medium',
  preferred_time_windows_json jsonb not null default '[]'::jsonb,
  mobility_prefs_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_preferences_pace_chk check (pace_default in ('relaxed', 'balanced', 'active')),
  constraint user_preferences_budget_chk check (budget_default in ('low', 'medium', 'high'))
);

create table if not exists public.trip_context_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  city_id text not null references public.cities(id),
  context_type text not null,
  group_size integer not null default 1,
  with_kids boolean not null default false,
  pace text not null default 'balanced',
  budget text not null default 'medium',
  transport_mode text not null default 'mixed',
  time_budget_min integer not null,
  start_local timestamptz,
  vibe_tags_json jsonb not null default '[]'::jsonb,
  constraints_json jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_context_context_type_chk check (context_type in ('solo', 'couple', 'family', 'friends')),
  constraint trip_context_group_size_chk check (group_size >= 1 and group_size <= 20),
  constraint trip_context_pace_chk check (pace in ('relaxed', 'balanced', 'active')),
  constraint trip_context_budget_chk check (budget in ('low', 'medium', 'high')),
  constraint trip_context_transport_mode_chk check (transport_mode in ('walk', 'public_transit', 'bike', 'car', 'mixed')),
  constraint trip_context_time_budget_chk check (time_budget_min between 30 and 720),
  constraint trip_context_status_chk check (status in ('active', 'completed', 'cancelled'))
);

create index if not exists trip_context_sessions_user_created_idx
  on public.trip_context_sessions(user_id, created_at desc);
create index if not exists trip_context_sessions_city_created_idx
  on public.trip_context_sessions(city_id, created_at desc);
create index if not exists trip_context_sessions_user_active_idx
  on public.trip_context_sessions(user_id)
  where status = 'active';

create table if not exists public.quest_experience_tags (
  quest_id uuid primary key references public.quests(id) on delete cascade,
  family_safe boolean not null default false,
  date_friendly boolean not null default false,
  kid_friendly boolean not null default false,
  wheelchair_accessible boolean not null default false,
  low_crowd boolean not null default false,
  indoor_option boolean not null default false,
  best_time_json jsonb not null default '[]'::jsonb,
  safety_notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.recommendation_feedback (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_context_id uuid references public.trip_context_sessions(id) on delete set null,
  quest_id uuid not null references public.quests(id) on delete cascade,
  feedback_type text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint recommendation_feedback_type_chk check (
    feedback_type in ('shown', 'opened', 'started', 'completed', 'dismissed', 'saved')
  )
);

create index if not exists recommendation_feedback_user_created_idx
  on public.recommendation_feedback(user_id, created_at desc);

insert into public.quest_experience_tags (
  quest_id,
  family_safe,
  date_friendly,
  kid_friendly,
  wheelchair_accessible,
  low_crowd,
  indoor_option,
  best_time_json,
  safety_notes
)
select
  q.id,
  case when q.title = 'Cubbon Park Morning Walk' then true else false end,
  case when q.title = 'MG Road Coffee Stop' then true else false end,
  case when q.title = 'Cubbon Park Morning Walk' then true else false end,
  case when q.title = 'Lalbagh Culture Quest' then true else false end,
  case when q.title = 'Cubbon Park Morning Walk' then true else false end,
  case when q.title = 'MG Road Coffee Stop' then true else false end,
  '["morning","evening"]'::jsonb,
  null
from public.quests q
where q.city_id = 'blr'
on conflict (quest_id) do update set
  family_safe = excluded.family_safe,
  date_friendly = excluded.date_friendly,
  kid_friendly = excluded.kid_friendly,
  wheelchair_accessible = excluded.wheelchair_accessible,
  low_crowd = excluded.low_crowd,
  indoor_option = excluded.indoor_option,
  best_time_json = excluded.best_time_json,
  safety_notes = excluded.safety_notes,
  updated_at = now();

drop trigger if exists user_preferences_touch on public.user_preferences;
create trigger user_preferences_touch
before update on public.user_preferences
for each row execute function public.touch_updated_at();

drop trigger if exists trip_context_sessions_touch on public.trip_context_sessions;
create trigger trip_context_sessions_touch
before update on public.trip_context_sessions
for each row execute function public.touch_updated_at();

drop trigger if exists quest_experience_tags_touch on public.quest_experience_tags;
create trigger quest_experience_tags_touch
before update on public.quest_experience_tags
for each row execute function public.touch_updated_at();

create or replace function public.start_trip_context(
  p_user_id uuid,
  p_city_id text,
  p_context_type text,
  p_group_size integer default 1,
  p_with_kids boolean default false,
  p_pace text default 'balanced',
  p_budget text default 'medium',
  p_transport_mode text default 'mixed',
  p_time_budget_min integer default 180,
  p_start_local timestamptz default null,
  p_vibe_tags jsonb default '[]'::jsonb,
  p_constraints jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.trip_context_sessions;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1
    from public.cities c
    where c.id = p_city_id
      and c.is_active = true
  ) then
    raise exception 'invalid_city';
  end if;

  update public.trip_context_sessions
  set status = 'cancelled',
      updated_at = now()
  where user_id = p_user_id
    and status = 'active';

  insert into public.trip_context_sessions (
    user_id,
    city_id,
    context_type,
    group_size,
    with_kids,
    pace,
    budget,
    transport_mode,
    time_budget_min,
    start_local,
    vibe_tags_json,
    constraints_json,
    status
  )
  values (
    p_user_id,
    p_city_id,
    p_context_type,
    coalesce(p_group_size, 1),
    coalesce(p_with_kids, false),
    coalesce(p_pace, 'balanced'),
    coalesce(p_budget, 'medium'),
    coalesce(p_transport_mode, 'mixed'),
    coalesce(p_time_budget_min, 180),
    p_start_local,
    coalesce(p_vibe_tags, '[]'::jsonb),
    coalesce(p_constraints, '{}'::jsonb),
    'active'
  )
  returning * into v_trip;

  return jsonb_build_object(
    'tripContextId', v_trip.id::text,
    'status', v_trip.status,
    'cityId', v_trip.city_id,
    'contextType', v_trip.context_type,
    'createdAt', v_trip.created_at
  );
end;
$$;

create or replace function public.update_trip_context(
  p_user_id uuid,
  p_trip_context_id uuid,
  p_context_type text default null,
  p_group_size integer default null,
  p_with_kids boolean default null,
  p_pace text default null,
  p_budget text default null,
  p_transport_mode text default null,
  p_time_budget_min integer default null,
  p_start_local timestamptz default null,
  p_vibe_tags jsonb default null,
  p_constraints jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.trip_context_sessions;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'forbidden';
  end if;

  update public.trip_context_sessions
  set context_type = coalesce(p_context_type, context_type),
      group_size = coalesce(p_group_size, group_size),
      with_kids = coalesce(p_with_kids, with_kids),
      pace = coalesce(p_pace, pace),
      budget = coalesce(p_budget, budget),
      transport_mode = coalesce(p_transport_mode, transport_mode),
      time_budget_min = coalesce(p_time_budget_min, time_budget_min),
      start_local = coalesce(p_start_local, start_local),
      vibe_tags_json = coalesce(p_vibe_tags, vibe_tags_json),
      constraints_json = coalesce(p_constraints, constraints_json),
      updated_at = now()
  where id = p_trip_context_id
    and user_id = p_user_id
    and status = 'active'
  returning * into v_trip;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'tripContextId', v_trip.id::text,
    'userId', v_trip.user_id::text,
    'cityId', v_trip.city_id,
    'contextType', v_trip.context_type,
    'groupSize', v_trip.group_size,
    'withKids', v_trip.with_kids,
    'pace', v_trip.pace,
    'budget', v_trip.budget,
    'transportMode', v_trip.transport_mode,
    'timeBudgetMin', v_trip.time_budget_min,
    'startLocal', v_trip.start_local,
    'vibeTags', v_trip.vibe_tags_json,
    'constraints', v_trip.constraints_json,
    'status', v_trip.status,
    'createdAt', v_trip.created_at,
    'updatedAt', v_trip.updated_at
  );
end;
$$;

create or replace function public.end_trip_context(
  p_user_id uuid,
  p_trip_context_id uuid,
  p_status text default 'completed'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.trip_context_sessions;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'forbidden';
  end if;

  if p_status not in ('completed', 'cancelled') then
    raise exception 'invalid_status';
  end if;

  update public.trip_context_sessions
  set status = p_status,
      updated_at = now()
  where id = p_trip_context_id
    and user_id = p_user_id
    and status = 'active'
  returning * into v_trip;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'tripContextId', v_trip.id::text,
    'status', v_trip.status,
    'endedAt', v_trip.updated_at
  );
end;
$$;

create or replace function public.get_recommended_quests(
  p_user_id uuid,
  p_city_id text,
  p_trip_context_id uuid,
  p_limit integer default 20
)
returns table (
  quest_id uuid,
  city_id text,
  title text,
  description text,
  category text,
  geofence jsonb,
  xp_reward integer,
  badge_key text,
  active_from timestamptz,
  active_to timestamptz,
  tags_json jsonb,
  why_recommended text[],
  score double precision
)
language plpgsql
stable
as $$
declare
  v_context public.trip_context_sessions;
  v_origin_lat double precision;
  v_origin_lng double precision;
  v_limit integer;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'forbidden';
  end if;

  select *
  into v_context
  from public.trip_context_sessions t
  where t.id = p_trip_context_id
    and t.user_id = p_user_id
  limit 1;

  if not found then
    raise exception 'trip_context_not_found';
  end if;

  if v_context.city_id <> p_city_id then
    raise exception 'trip_context_city_mismatch';
  end if;

  select
    (qc.location_json->>'lat')::double precision,
    (qc.location_json->>'lng')::double precision
  into v_origin_lat, v_origin_lng
  from public.quest_completions qc
  join public.quests q on q.id = qc.quest_id
  where qc.user_id = p_user_id
    and qc.status = 'accepted'
    and q.city_id = p_city_id
  order by qc.occurred_at desc
  limit 1;

  v_limit := greatest(1, least(coalesce(p_limit, 20), 50));

  return query
  with base as (
    select
      q.id as qid,
      q.city_id as q_city_id,
      q.title as q_title,
      q.description as q_description,
      q.category as q_category,
      q.geofence_json as q_geofence,
      q.xp_reward as q_xp_reward,
      q.badge_key as q_badge_key,
      q.active_from as q_active_from,
      q.active_to as q_active_to,
      coalesce(qet.family_safe, false) as family_safe,
      coalesce(qet.date_friendly, false) as date_friendly,
      coalesce(qet.kid_friendly, false) as kid_friendly,
      coalesce(qet.wheelchair_accessible, false) as wheelchair_accessible,
      coalesce(qet.low_crowd, false) as low_crowd,
      coalesce(qet.indoor_option, false) as indoor_option,
      case
        when v_origin_lat is null or v_origin_lng is null then null
        else public.haversine_m(
          v_origin_lat,
          v_origin_lng,
          (q.geofence_json->>'lat')::double precision,
          (q.geofence_json->>'lng')::double precision
        )
      end as distance_m,
      extract(epoch from greatest(interval '0 seconds', now() - q.active_from)) / 86400.0 as active_age_days
    from public.quests q
    left join public.quest_experience_tags qet
      on qet.quest_id = q.id
    where q.city_id = p_city_id
      and q.is_active = true
      and q.active_from <= now()
      and (q.active_to is null or q.active_to >= now())
  ),
  scored as (
    select
      b.*,
      case
        when b.distance_m is null then 0.60::double precision
        else greatest(0::double precision, (1500 - least(b.distance_m, 1500)) / 1500)
      end as distance_score,
      (
        case
          when v_context.context_type = 'family' and b.family_safe then 1.20::double precision
          when v_context.context_type = 'couple' and b.date_friendly then 1.20::double precision
          when v_context.context_type = 'solo' and b.low_crowd then 0.90::double precision
          when v_context.context_type = 'friends' and b.indoor_option then 0.60::double precision
          else 0::double precision
        end
        + case when v_context.with_kids and b.kid_friendly then 1.00::double precision else 0::double precision end
        + case when v_context.transport_mode in ('walk', 'public_transit') and b.wheelchair_accessible then 0.40::double precision else 0::double precision end
      ) as context_score,
      greatest(0::double precision, 1 - (least(b.active_age_days, 30) / 30)) as freshness_score
    from base b
  ),
  ranked as (
    select
      s.*,
      (s.distance_score + s.context_score + s.freshness_score) as total_score,
      array_remove(array[
        case when s.distance_m is not null and s.distance_m <= 1200 then 'close to your recent activity' end,
        case when v_context.context_type = 'family' and (s.family_safe or s.kid_friendly) then 'family-safe and kid-friendly' end,
        case when v_context.context_type = 'couple' and s.date_friendly then 'date-friendly for your outing' end,
        case when v_context.context_type = 'solo' and s.low_crowd then 'good for a quieter solo outing' end,
        case when s.freshness_score >= 0.70 then 'freshly curated active quest' end,
        case when s.context_score = 0 then 'popular nearby fallback' end
      ], null) as reasons
    from scored s
  )
  select
    r.qid,
    r.q_city_id,
    r.q_title,
    r.q_description,
    r.q_category,
    r.q_geofence,
    r.q_xp_reward,
    r.q_badge_key,
    r.q_active_from,
    r.q_active_to,
    jsonb_build_object(
      'familySafe', r.family_safe,
      'dateFriendly', r.date_friendly,
      'kidFriendly', r.kid_friendly,
      'wheelchairAccessible', r.wheelchair_accessible,
      'lowCrowd', r.low_crowd,
      'indoorOption', r.indoor_option
    ) as tags_json,
    case
      when cardinality(r.reasons) = 0 then array['popular nearby fallback']::text[]
      else r.reasons
    end as why_recommended,
    r.total_score
  from ranked r
  order by r.total_score desc, r.q_active_from desc
  limit v_limit;
end;
$$;

create or replace function public.record_recommendation_feedback(
  p_user_id uuid,
  p_trip_context_id uuid,
  p_quest_id uuid,
  p_feedback_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_feedback_id uuid;
  v_created_at timestamptz;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'forbidden';
  end if;

  if p_trip_context_id is not null and not exists (
    select 1
    from public.trip_context_sessions t
    where t.id = p_trip_context_id
      and t.user_id = p_user_id
  ) then
    raise exception 'trip_context_not_found';
  end if;

  insert into public.recommendation_feedback (
    user_id,
    trip_context_id,
    quest_id,
    feedback_type,
    metadata_json
  )
  values (
    p_user_id,
    p_trip_context_id,
    p_quest_id,
    p_feedback_type,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id, created_at
  into v_feedback_id, v_created_at;

  return jsonb_build_object(
    'status', 'recorded',
    'feedbackId', v_feedback_id::text,
    'createdAt', v_created_at
  );
end;
$$;

alter table public.user_preferences enable row level security;
alter table public.trip_context_sessions enable row level security;
alter table public.quest_experience_tags enable row level security;
alter table public.recommendation_feedback enable row level security;

drop policy if exists "user_preferences_select_self" on public.user_preferences;
create policy "user_preferences_select_self"
on public.user_preferences for select
using (auth.uid() = user_id);

drop policy if exists "user_preferences_update_self" on public.user_preferences;
create policy "user_preferences_update_self"
on public.user_preferences for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "trip_context_sessions_select_self" on public.trip_context_sessions;
create policy "trip_context_sessions_select_self"
on public.trip_context_sessions for select
using (auth.uid() = user_id);

drop policy if exists "trip_context_sessions_insert_self" on public.trip_context_sessions;
create policy "trip_context_sessions_insert_self"
on public.trip_context_sessions for insert
with check (auth.uid() = user_id);

drop policy if exists "trip_context_sessions_update_self" on public.trip_context_sessions;
create policy "trip_context_sessions_update_self"
on public.trip_context_sessions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "quest_experience_tags_select_authenticated" on public.quest_experience_tags;
create policy "quest_experience_tags_select_authenticated"
on public.quest_experience_tags for select
using (auth.role() = 'authenticated');

drop policy if exists "recommendation_feedback_select_self" on public.recommendation_feedback;
create policy "recommendation_feedback_select_self"
on public.recommendation_feedback for select
using (auth.uid() = user_id);

drop policy if exists "recommendation_feedback_insert_self" on public.recommendation_feedback;
create policy "recommendation_feedback_insert_self"
on public.recommendation_feedback for insert
with check (auth.uid() = user_id);

revoke insert, update, delete on public.quest_experience_tags from authenticated, anon;

grant execute on function public.start_trip_context(
  uuid,
  text,
  text,
  integer,
  boolean,
  text,
  text,
  text,
  integer,
  timestamptz,
  jsonb,
  jsonb
) to authenticated;

grant execute on function public.update_trip_context(
  uuid,
  uuid,
  text,
  integer,
  boolean,
  text,
  text,
  text,
  integer,
  timestamptz,
  jsonb,
  jsonb
) to authenticated;

grant execute on function public.end_trip_context(uuid, uuid, text) to authenticated;
grant execute on function public.get_recommended_quests(uuid, text, uuid, integer) to authenticated;
grant execute on function public.record_recommendation_feedback(uuid, uuid, uuid, text, jsonb) to authenticated;
