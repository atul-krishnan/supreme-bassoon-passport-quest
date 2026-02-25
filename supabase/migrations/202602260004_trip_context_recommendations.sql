-- Passport Quest v1.1 additive slice: trip context, recommendations, and saved plans.

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
  constraint trip_context_type_chk check (context_type in ('solo', 'couple', 'family', 'friends')),
  constraint trip_context_pace_chk check (pace in ('relaxed', 'balanced', 'active')),
  constraint trip_context_budget_chk check (budget in ('low', 'medium', 'high')),
  constraint trip_context_transport_chk check (
    transport_mode in ('walk', 'public_transit', 'bike', 'car', 'mixed')
  ),
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
  budget_band text not null default 'medium',
  recommended_duration_min integer not null default 90,
  practical_details_json jsonb not null default '[]'::jsonb,
  hero_image_url text,
  updated_at timestamptz not null default now(),
  constraint quest_experience_budget_band_chk check (budget_band in ('low', 'medium', 'high')),
  constraint quest_experience_duration_chk check (recommended_duration_min between 30 and 480)
);

create table if not exists public.recommendation_feedback (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_context_id uuid references public.trip_context_sessions(id) on delete set null,
  plan_id text not null,
  quest_id uuid references public.quests(id) on delete set null,
  feedback_type text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint recommendation_feedback_type_chk check (
    feedback_type in ('shown', 'opened', 'started', 'completed', 'dismissed', 'saved')
  )
);

create index if not exists recommendation_feedback_user_created_idx
  on public.recommendation_feedback(user_id, created_at desc);

create table if not exists public.saved_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  trip_context_id uuid references public.trip_context_sessions(id) on delete set null,
  city_id text not null references public.cities(id),
  plan_payload_json jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, plan_id)
);

create index if not exists saved_plans_user_updated_idx
  on public.saved_plans(user_id, updated_at desc);

drop trigger if exists trip_context_sessions_touch on public.trip_context_sessions;
create trigger trip_context_sessions_touch
before update on public.trip_context_sessions
for each row execute function public.touch_updated_at();

drop trigger if exists quest_experience_tags_touch on public.quest_experience_tags;
create trigger quest_experience_tags_touch
before update on public.quest_experience_tags
for each row execute function public.touch_updated_at();

drop trigger if exists saved_plans_touch on public.saved_plans;
create trigger saved_plans_touch
before update on public.saved_plans
for each row execute function public.touch_updated_at();

create or replace function public.start_trip_context(
  p_user_id uuid,
  p_city_id text,
  p_context_type text,
  p_time_budget_min integer,
  p_budget text default 'medium',
  p_pace text default 'balanced',
  p_vibe_tags jsonb default '[]'::jsonb,
  p_constraints jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context_id uuid;
  v_group_size integer := 1;
begin
  if p_context_type not in ('solo', 'couple', 'family', 'friends') then
    raise exception 'invalid_context_type';
  end if;

  if p_budget not in ('low', 'medium', 'high') then
    raise exception 'invalid_budget';
  end if;

  if p_pace not in ('relaxed', 'balanced', 'active') then
    raise exception 'invalid_pace';
  end if;

  if p_time_budget_min < 30 or p_time_budget_min > 720 then
    raise exception 'invalid_time_budget';
  end if;

  if p_context_type = 'couple' then
    v_group_size := 2;
  elsif p_context_type = 'family' then
    v_group_size := 3;
  elsif p_context_type = 'friends' then
    v_group_size := 4;
  end if;

  update public.trip_context_sessions
  set status = 'completed', updated_at = now()
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
    v_group_size,
    case when p_context_type = 'family' then true else false end,
    p_pace,
    p_budget,
    'mixed',
    p_time_budget_min,
    now(),
    coalesce(p_vibe_tags, '[]'::jsonb),
    coalesce(p_constraints, '{}'::jsonb),
    'active'
  )
  returning id into v_context_id;

  return jsonb_build_object(
    'tripContextId', v_context_id::text,
    'status', 'active',
    'cityId', p_city_id,
    'contextType', p_context_type,
    'createdAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updatedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

create or replace function public.update_trip_context(
  p_user_id uuid,
  p_trip_context_id uuid,
  p_context_type text default null,
  p_time_budget_min integer default null,
  p_budget text default null,
  p_pace text default null,
  p_vibe_tags jsonb default null,
  p_constraints jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.trip_context_sessions;
begin
  if p_context_type is not null and p_context_type not in ('solo', 'couple', 'family', 'friends') then
    raise exception 'invalid_context_type';
  end if;

  if p_budget is not null and p_budget not in ('low', 'medium', 'high') then
    raise exception 'invalid_budget';
  end if;

  if p_pace is not null and p_pace not in ('relaxed', 'balanced', 'active') then
    raise exception 'invalid_pace';
  end if;

  if p_time_budget_min is not null and (p_time_budget_min < 30 or p_time_budget_min > 720) then
    raise exception 'invalid_time_budget';
  end if;

  update public.trip_context_sessions t
  set
    context_type = coalesce(p_context_type, t.context_type),
    time_budget_min = coalesce(p_time_budget_min, t.time_budget_min),
    budget = coalesce(p_budget, t.budget),
    pace = coalesce(p_pace, t.pace),
    vibe_tags_json = coalesce(p_vibe_tags, t.vibe_tags_json),
    constraints_json = coalesce(p_constraints, t.constraints_json)
  where t.id = p_trip_context_id
    and t.user_id = p_user_id
  returning t.* into v_row;

  if v_row.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object(
    'tripContextId', v_row.id::text,
    'status', v_row.status,
    'cityId', v_row.city_id,
    'contextType', v_row.context_type,
    'createdAt', to_char(v_row.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updatedAt', to_char(v_row.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
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
  v_row public.trip_context_sessions;
begin
  if p_status not in ('completed', 'cancelled') then
    raise exception 'invalid_status';
  end if;

  update public.trip_context_sessions t
  set status = p_status
  where t.id = p_trip_context_id
    and t.user_id = p_user_id
  returning t.* into v_row;

  if v_row.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object(
    'tripContextId', v_row.id::text,
    'status', v_row.status
  );
end;
$$;

create or replace function public.record_recommendation_feedback(
  p_user_id uuid,
  p_trip_context_id uuid,
  p_plan_id text,
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
begin
  if p_feedback_type not in ('shown', 'opened', 'started', 'completed', 'dismissed', 'saved') then
    raise exception 'invalid_feedback_type';
  end if;

  insert into public.recommendation_feedback (
    user_id,
    trip_context_id,
    plan_id,
    quest_id,
    feedback_type,
    metadata_json
  )
  values (
    p_user_id,
    p_trip_context_id,
    p_plan_id,
    p_quest_id,
    p_feedback_type,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_feedback_id;

  return jsonb_build_object(
    'status', 'recorded',
    'feedbackId', v_feedback_id::text
  );
end;
$$;

create or replace function public.save_plan(
  p_user_id uuid,
  p_plan_id text,
  p_trip_context_id uuid,
  p_city_id text,
  p_plan_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  insert into public.saved_plans (
    user_id,
    plan_id,
    trip_context_id,
    city_id,
    plan_payload_json,
    saved_at,
    updated_at
  )
  values (
    p_user_id,
    p_plan_id,
    p_trip_context_id,
    p_city_id,
    coalesce(p_plan_payload, '{}'::jsonb),
    v_now,
    v_now
  )
  on conflict (user_id, plan_id)
  do update set
    trip_context_id = excluded.trip_context_id,
    city_id = excluded.city_id,
    plan_payload_json = excluded.plan_payload_json,
    updated_at = v_now;

  with ranked as (
    select
      sp.plan_id,
      row_number() over (
        order by sp.updated_at desc, sp.saved_at desc, sp.plan_id desc
      ) as rn
    from public.saved_plans sp
    where sp.user_id = p_user_id
  )
  delete from public.saved_plans sp
  using ranked r
  where sp.user_id = p_user_id
    and sp.plan_id = r.plan_id
    and r.rn > 50;

  return jsonb_build_object(
    'status', 'saved',
    'planId', p_plan_id,
    'updatedAt', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

create or replace function public.get_saved_plans(
  p_user_id uuid,
  p_limit integer default 20,
  p_cursor timestamptz default null
)
returns table (
  plan_id text,
  trip_context_id uuid,
  city_id text,
  plan_payload jsonb,
  saved_at timestamptz,
  updated_at timestamptz
)
language sql
stable
as $$
  select
    sp.plan_id,
    sp.trip_context_id,
    sp.city_id,
    sp.plan_payload_json as plan_payload,
    sp.saved_at,
    sp.updated_at
  from public.saved_plans sp
  where sp.user_id = p_user_id
    and (p_cursor is null or sp.updated_at < p_cursor)
  order by sp.updated_at desc
  limit greatest(1, least(p_limit, 100));
$$;

create or replace function public.delete_saved_plan(
  p_user_id uuid,
  p_plan_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  delete from public.saved_plans sp
  where sp.user_id = p_user_id
    and sp.plan_id = p_plan_id;

  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'status', case when v_deleted > 0 then 'deleted' else 'not_found' end,
    'planId', p_plan_id
  );
end;
$$;

alter table public.trip_context_sessions enable row level security;
alter table public.quest_experience_tags enable row level security;
alter table public.recommendation_feedback enable row level security;
alter table public.saved_plans enable row level security;

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

drop policy if exists "saved_plans_select_self" on public.saved_plans;
create policy "saved_plans_select_self"
on public.saved_plans for select
using (auth.uid() = user_id);

drop policy if exists "saved_plans_insert_self" on public.saved_plans;
create policy "saved_plans_insert_self"
on public.saved_plans for insert
with check (auth.uid() = user_id);

drop policy if exists "saved_plans_update_self" on public.saved_plans;
create policy "saved_plans_update_self"
on public.saved_plans for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "saved_plans_delete_self" on public.saved_plans;
create policy "saved_plans_delete_self"
on public.saved_plans for delete
using (auth.uid() = user_id);

revoke insert, update, delete on public.quest_experience_tags from authenticated, anon;
revoke update, delete on public.recommendation_feedback from authenticated, anon;

grant execute on function public.start_trip_context(uuid, text, text, integer, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.update_trip_context(uuid, uuid, text, integer, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.end_trip_context(uuid, uuid, text) to authenticated;
grant execute on function public.record_recommendation_feedback(uuid, uuid, text, uuid, text, jsonb) to authenticated;
grant execute on function public.save_plan(uuid, text, uuid, text, jsonb) to authenticated;
grant execute on function public.get_saved_plans(uuid, integer, timestamptz) to authenticated;
grant execute on function public.delete_saved_plan(uuid, text) to authenticated;

insert into public.quest_experience_tags (
  quest_id,
  family_safe,
  date_friendly,
  kid_friendly,
  low_crowd,
  indoor_option,
  budget_band,
  recommended_duration_min,
  practical_details_json
)
select
  q.id,
  true,
  false,
  true,
  true,
  false,
  'low',
  90,
  '["Best in early morning","Carry water"]'::jsonb
from public.quests q
where q.title = 'Cubbon Park Morning Walk'
on conflict (quest_id) do update set
  family_safe = excluded.family_safe,
  date_friendly = excluded.date_friendly,
  kid_friendly = excluded.kid_friendly,
  low_crowd = excluded.low_crowd,
  indoor_option = excluded.indoor_option,
  budget_band = excluded.budget_band,
  recommended_duration_min = excluded.recommended_duration_min,
  practical_details_json = excluded.practical_details_json;

insert into public.quest_experience_tags (
  quest_id,
  family_safe,
  date_friendly,
  kid_friendly,
  low_crowd,
  indoor_option,
  budget_band,
  recommended_duration_min,
  practical_details_json
)
select
  q.id,
  false,
  true,
  false,
  false,
  true,
  'medium',
  75,
  '["Great for evening date plans","Parking nearby"]'::jsonb
from public.quests q
where q.title = 'MG Road Coffee Stop'
on conflict (quest_id) do update set
  family_safe = excluded.family_safe,
  date_friendly = excluded.date_friendly,
  kid_friendly = excluded.kid_friendly,
  low_crowd = excluded.low_crowd,
  indoor_option = excluded.indoor_option,
  budget_band = excluded.budget_band,
  recommended_duration_min = excluded.recommended_duration_min,
  practical_details_json = excluded.practical_details_json;

insert into public.quest_experience_tags (
  quest_id,
  family_safe,
  date_friendly,
  kid_friendly,
  low_crowd,
  indoor_option,
  budget_band,
  recommended_duration_min,
  practical_details_json
)
select
  q.id,
  true,
  true,
  true,
  false,
  false,
  'medium',
  120,
  '["Ideal for half-day plans","Prefer cooler hours"]'::jsonb
from public.quests q
where q.title = 'Lalbagh Culture Quest'
on conflict (quest_id) do update set
  family_safe = excluded.family_safe,
  date_friendly = excluded.date_friendly,
  kid_friendly = excluded.kid_friendly,
  low_crowd = excluded.low_crowd,
  indoor_option = excluded.indoor_option,
  budget_band = excluded.budget_band,
  recommended_duration_min = excluded.recommended_duration_min,
  practical_details_json = excluded.practical_details_json;

update public.city_runtime_config crc
set
  feature_flags_json = coalesce(crc.feature_flags_json, '{}'::jsonb) ||
    case
      when coalesce(crc.feature_flags_json, '{}'::jsonb) ? 'planV1Enabled' then '{}'::jsonb
      else '{"planV1Enabled": false}'::jsonb
    end,
  updated_at = now();
