-- FlowState reset: decision-first execution assistant tables and RPC surface.

alter table public.user_stats
  add column if not exists plays_completed integer not null default 0,
  add column if not exists decisions_saved integer not null default 0,
  add column if not exists planning_minutes_saved integer not null default 0;

create table if not exists public.user_flow_diagnostics (
  user_id uuid primary key references auth.users(id) on delete cascade,
  energy_baseline text not null,
  focus_pillar text not null,
  friction_point text not null,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_flow_diagnostics_energy_chk
    check (energy_baseline in ('low', 'balanced', 'high')),
  constraint user_flow_diagnostics_focus_chk
    check (focus_pillar in ('deep_work', 'vitality_health', 'local_discovery')),
  constraint user_flow_diagnostics_friction_chk
    check (friction_point in ('decision_paralysis', 'procrastination'))
);

create table if not exists public.play_templates (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  focus_pillar text not null,
  default_duration_min integer not null,
  xp_reward integer not null default 80,
  decision_minutes_saved integer not null default 30,
  geo_scope text not null default 'global',
  country_code text,
  city_id text references public.cities(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint play_templates_focus_chk
    check (focus_pillar in ('deep_work', 'vitality_health', 'local_discovery')),
  constraint play_templates_duration_chk
    check (default_duration_min between 10 and 240),
  constraint play_templates_xp_reward_chk
    check (xp_reward between 10 and 500),
  constraint play_templates_decision_saved_chk
    check (decision_minutes_saved between 5 and 360),
  constraint play_templates_geo_scope_chk
    check (geo_scope in ('global', 'country', 'city'))
);

create table if not exists public.play_template_steps (
  id uuid primary key default extensions.gen_random_uuid(),
  play_template_id uuid not null references public.play_templates(id) on delete cascade,
  step_order integer not null,
  title text not null,
  instruction text not null,
  duration_sec integer not null,
  created_at timestamptz not null default now(),
  constraint play_template_steps_order_chk check (step_order between 1 and 10),
  constraint play_template_steps_duration_chk check (duration_sec between 30 and 7200)
);

create unique index if not exists play_template_steps_play_order_uidx
  on public.play_template_steps(play_template_id, step_order);

create table if not exists public.play_recommendations (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  play_template_id uuid not null references public.play_templates(id) on delete cascade,
  city_id text references public.cities(id) on delete set null,
  reason_text text not null,
  context_json jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists play_recommendations_user_created_idx
  on public.play_recommendations(user_id, created_at desc);
create index if not exists play_recommendations_user_expires_idx
  on public.play_recommendations(user_id, expires_at desc);

create table if not exists public.play_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  play_template_id uuid not null references public.play_templates(id) on delete cascade,
  recommendation_id uuid references public.play_recommendations(id) on delete set null,
  status text not null default 'in_progress',
  current_step_order integer,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  xp_reward_snapshot integer not null default 0,
  xp_awarded integer not null default 0,
  decision_minutes_saved_snapshot integer not null default 0,
  trust_reason_snapshot text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint play_sessions_status_chk
    check (status in ('in_progress', 'paused', 'completed', 'cancelled')),
  constraint play_sessions_current_step_chk
    check (current_step_order is null or current_step_order between 1 and 10),
  constraint play_sessions_xp_reward_snapshot_chk check (xp_reward_snapshot >= 0),
  constraint play_sessions_xp_awarded_chk check (xp_awarded >= 0),
  constraint play_sessions_decisions_saved_chk check (decision_minutes_saved_snapshot >= 0)
);

create index if not exists play_sessions_user_updated_idx
  on public.play_sessions(user_id, updated_at desc);
create index if not exists play_sessions_user_active_idx
  on public.play_sessions(user_id)
  where status in ('in_progress', 'paused');

create table if not exists public.play_session_steps (
  play_session_id uuid not null references public.play_sessions(id) on delete cascade,
  step_order integer not null,
  title text not null,
  instruction text not null,
  duration_sec integer not null,
  status text not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  primary key (play_session_id, step_order),
  constraint play_session_steps_status_chk
    check (status in ('pending', 'active', 'completed')),
  constraint play_session_steps_duration_chk
    check (duration_sec between 30 and 7200)
);

create index if not exists play_session_steps_session_status_idx
  on public.play_session_steps(play_session_id, status, step_order);

drop trigger if exists user_flow_diagnostics_touch on public.user_flow_diagnostics;
create trigger user_flow_diagnostics_touch
before update on public.user_flow_diagnostics
for each row execute function public.touch_updated_at();

drop trigger if exists play_templates_touch on public.play_templates;
create trigger play_templates_touch
before update on public.play_templates
for each row execute function public.touch_updated_at();

drop trigger if exists play_sessions_touch on public.play_sessions;
create trigger play_sessions_touch
before update on public.play_sessions
for each row execute function public.touch_updated_at();

create or replace function public.upsert_user_flow_diagnostic(
  p_user_id uuid,
  p_energy_baseline text,
  p_focus_pillar text,
  p_friction_point text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completed_at timestamptz := now();
begin
  if p_energy_baseline not in ('low', 'balanced', 'high') then
    raise exception 'invalid_energy_baseline';
  end if;

  if p_focus_pillar not in ('deep_work', 'vitality_health', 'local_discovery') then
    raise exception 'invalid_focus_pillar';
  end if;

  if p_friction_point not in ('decision_paralysis', 'procrastination') then
    raise exception 'invalid_friction_point';
  end if;

  insert into public.user_flow_diagnostics (
    user_id,
    energy_baseline,
    focus_pillar,
    friction_point,
    completed_at,
    updated_at
  )
  values (
    p_user_id,
    p_energy_baseline,
    p_focus_pillar,
    p_friction_point,
    v_completed_at,
    v_completed_at
  )
  on conflict (user_id)
  do update set
    energy_baseline = excluded.energy_baseline,
    focus_pillar = excluded.focus_pillar,
    friction_point = excluded.friction_point,
    completed_at = excluded.completed_at,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'status', 'saved',
    'completedAt', to_char(v_completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'energyBaseline', p_energy_baseline,
    'focusPillar', p_focus_pillar,
    'frictionPoint', p_friction_point
  );
end;
$$;

create or replace function public.get_hero_play(
  p_user_id uuid,
  p_city_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_diag public.user_flow_diagnostics;
  v_template public.play_templates;
  v_steps jsonb := '[]'::jsonb;
  v_reason text;
  v_energy_hint text;
  v_recommendation_id uuid;
  v_country text;
begin
  select *
  into v_diag
  from public.user_flow_diagnostics d
  where d.user_id = p_user_id
  limit 1;

  if v_diag.user_id is null then
    return jsonb_build_object('status', 'diagnostic_required');
  end if;

  if p_city_id is not null then
    select c.country
    into v_country
    from public.cities c
    where c.id = p_city_id
    limit 1;
  end if;

  select pt.*
  into v_template
  from public.play_templates pt
  where pt.is_active = true
    and pt.focus_pillar = v_diag.focus_pillar
    and (
      pt.geo_scope = 'global'
      or (pt.geo_scope = 'city' and p_city_id is not null and pt.city_id = p_city_id)
      or (
        pt.geo_scope = 'country'
        and v_country is not null
        and pt.country_code = v_country
      )
    )
  order by
    case pt.geo_scope
      when 'city' then 1
      when 'country' then 2
      else 3
    end,
    pt.updated_at desc,
    pt.created_at desc
  limit 1;

  if v_template.id is null then
    select pt.*
    into v_template
    from public.play_templates pt
    where pt.is_active = true
      and pt.focus_pillar = v_diag.focus_pillar
    order by pt.updated_at desc, pt.created_at desc
    limit 1;
  end if;

  if v_template.id is null then
    return jsonb_build_object('status', 'diagnostic_required');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'order', pts.step_order,
        'title', pts.title,
        'instruction', pts.instruction,
        'durationSec', pts.duration_sec
      )
      order by pts.step_order
    ),
    '[]'::jsonb
  )
  into v_steps
  from public.play_template_steps pts
  where pts.play_template_id = v_template.id;

  v_energy_hint := case v_diag.energy_baseline
    when 'high' then 'your energy is peak'
    when 'balanced' then 'your current energy is steady'
    else 'your energy is low and this keeps momentum light'
  end;

  v_reason := format(
    'Hand-picked because %s and you have a %s-min execution window.',
    v_energy_hint,
    v_template.default_duration_min
  );

  insert into public.play_recommendations (
    user_id,
    play_template_id,
    city_id,
    reason_text,
    context_json,
    expires_at
  )
  values (
    p_user_id,
    v_template.id,
    p_city_id,
    v_reason,
    jsonb_build_object(
      'energyBaseline', v_diag.energy_baseline,
      'focusPillar', v_diag.focus_pillar,
      'frictionPoint', v_diag.friction_point
    ),
    now() + interval '12 hours'
  )
  returning id into v_recommendation_id;

  return jsonb_build_object(
    'status', 'ready',
    'diagnosticCompletedAt',
      to_char(v_diag.completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'heroPlay',
      jsonb_build_object(
        'recommendationId', v_recommendation_id::text,
        'playId', v_template.id::text,
        'title', v_template.title,
        'summary', v_template.summary,
        'focusPillar', v_template.focus_pillar,
        'durationMin', v_template.default_duration_min,
        'xpReward', v_template.xp_reward,
        'decisionMinutesSaved', v_template.decision_minutes_saved,
        'why', v_reason,
        'steps', v_steps,
        'expiresAt',
          to_char((now() + interval '12 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
  );
end;
$$;

create or replace function public.get_play_session_detail(
  p_user_id uuid,
  p_play_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
begin
  select
    ps.id as session_id,
    ps.play_template_id as play_id,
    ps.recommendation_id,
    pt.title,
    pt.focus_pillar,
    ps.status,
    ps.current_step_order,
    ps.started_at,
    ps.completed_at,
    ps.xp_reward_snapshot as xp_reward,
    ps.decision_minutes_saved_snapshot as decision_minutes_saved,
    ps.trust_reason_snapshot as why,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'order', pss.step_order,
          'title', pss.title,
          'instruction', pss.instruction,
          'durationSec', pss.duration_sec,
          'status', pss.status,
          'startedAt',
            case
              when pss.started_at is null then null
              else to_char(pss.started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            end,
          'completedAt',
            case
              when pss.completed_at is null then null
              else to_char(pss.completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            end
        )
        order by pss.step_order
      ) filter (where pss.step_order is not null),
      '[]'::jsonb
    ) as steps_json
  into v_session
  from public.play_sessions ps
  join public.play_templates pt
    on pt.id = ps.play_template_id
  left join public.play_session_steps pss
    on pss.play_session_id = ps.id
  where ps.id = p_play_session_id
    and ps.user_id = p_user_id
  group by
    ps.id,
    ps.play_template_id,
    ps.recommendation_id,
    pt.title,
    pt.focus_pillar,
    ps.status,
    ps.current_step_order,
    ps.started_at,
    ps.completed_at,
    ps.xp_reward_snapshot,
    ps.decision_minutes_saved_snapshot,
    ps.trust_reason_snapshot;

  if v_session.session_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'session',
      jsonb_build_object(
        'sessionId', v_session.session_id::text,
        'playId', v_session.play_id::text,
        'recommendationId',
          case
            when v_session.recommendation_id is null then null
            else v_session.recommendation_id::text
          end,
        'title', v_session.title,
        'focusPillar', v_session.focus_pillar,
        'status', v_session.status,
        'currentStepOrder', v_session.current_step_order,
        'startedAt', to_char(v_session.started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'completedAt',
          case
            when v_session.completed_at is null then null
            else to_char(v_session.completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          end,
        'xpReward', v_session.xp_reward,
        'decisionMinutesSaved', v_session.decision_minutes_saved,
        'why', v_session.why,
        'steps', v_session.steps_json
      )
  );
end;
$$;

create or replace function public.start_play_session(
  p_user_id uuid,
  p_recommendation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recommendation record;
  v_session_id uuid;
begin
  select
    pr.id,
    pr.play_template_id,
    pr.reason_text,
    pt.xp_reward,
    pt.decision_minutes_saved
  into v_recommendation
  from public.play_recommendations pr
  join public.play_templates pt
    on pt.id = pr.play_template_id
  where pr.id = p_recommendation_id
    and pr.user_id = p_user_id
    and pr.expires_at >= now()
    and pt.is_active = true
  limit 1;

  if v_recommendation.id is null then
    return jsonb_build_object('status', 'recommendation_not_found');
  end if;

  update public.play_sessions
  set
    status = 'cancelled',
    completed_at = coalesce(completed_at, now()),
    updated_at = now()
  where user_id = p_user_id
    and status in ('in_progress', 'paused');

  insert into public.play_sessions (
    user_id,
    play_template_id,
    recommendation_id,
    status,
    current_step_order,
    started_at,
    xp_reward_snapshot,
    xp_awarded,
    decision_minutes_saved_snapshot,
    trust_reason_snapshot,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    v_recommendation.play_template_id,
    v_recommendation.id,
    'in_progress',
    1,
    now(),
    v_recommendation.xp_reward,
    0,
    v_recommendation.decision_minutes_saved,
    v_recommendation.reason_text,
    now(),
    now()
  )
  returning id into v_session_id;

  insert into public.play_session_steps (
    play_session_id,
    step_order,
    title,
    instruction,
    duration_sec,
    status,
    started_at,
    completed_at
  )
  select
    v_session_id,
    pts.step_order,
    pts.title,
    pts.instruction,
    pts.duration_sec,
    case when pts.step_order = 1 then 'active' else 'pending' end,
    case when pts.step_order = 1 then now() else null end,
    null
  from public.play_template_steps pts
  where pts.play_template_id = v_recommendation.play_template_id
  order by pts.step_order;

  return jsonb_build_object(
    'status', 'started',
    'session', (public.get_play_session_detail(p_user_id, v_session_id)->'session')
  );
end;
$$;

create or replace function public.mark_play_step_done(
  p_user_id uuid,
  p_play_session_id uuid,
  p_step_order integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.play_sessions;
  v_next_order integer;
  v_totals record;
  v_session_payload jsonb;
begin
  select *
  into v_session
  from public.play_sessions ps
  where ps.id = p_play_session_id
    and ps.user_id = p_user_id
  for update;

  if v_session.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_session.status = 'completed' then
    return jsonb_build_object(
      'status', 'already_completed',
      'session', (public.get_play_session_detail(p_user_id, p_play_session_id)->'session')
    );
  end if;

  update public.play_session_steps
  set
    status = 'completed',
    completed_at = coalesce(completed_at, now())
  where play_session_id = p_play_session_id
    and step_order = p_step_order;

  select min(pss.step_order)
  into v_next_order
  from public.play_session_steps pss
  where pss.play_session_id = p_play_session_id
    and pss.status = 'pending';

  if v_next_order is null then
    update public.play_sessions
    set
      status = 'completed',
      current_step_order = null,
      completed_at = now(),
      xp_awarded = xp_reward_snapshot,
      updated_at = now()
    where id = p_play_session_id;

    insert into public.user_stats (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    update public.user_stats
    set
      xp_total = xp_total + v_session.xp_reward_snapshot,
      level = public.calculate_level(xp_total + v_session.xp_reward_snapshot),
      plays_completed = plays_completed + 1,
      decisions_saved = decisions_saved + 1,
      planning_minutes_saved = planning_minutes_saved + v_session.decision_minutes_saved_snapshot,
      last_active_date = current_date,
      updated_at = now()
    where user_id = p_user_id
    returning
      xp_total,
      level,
      plays_completed,
      decisions_saved,
      planning_minutes_saved
    into v_totals;

    v_session_payload := public.get_play_session_detail(p_user_id, p_play_session_id)->'session';

    return jsonb_build_object(
      'status', 'completed',
      'session', v_session_payload,
      'reward', jsonb_build_object(
        'xpAwarded', v_session.xp_reward_snapshot,
        'newTotals', jsonb_build_object(
          'xp', coalesce(v_totals.xp_total, 0),
          'level', coalesce(v_totals.level, 1),
          'playsCompleted', coalesce(v_totals.plays_completed, 0),
          'decisionsSaved', coalesce(v_totals.decisions_saved, 0),
          'planningMinutesSaved', coalesce(v_totals.planning_minutes_saved, 0)
        )
      )
    );
  end if;

  update public.play_session_steps
  set status = 'pending'
  where play_session_id = p_play_session_id
    and status = 'active';

  update public.play_session_steps
  set
    status = 'active',
    started_at = coalesce(started_at, now())
  where play_session_id = p_play_session_id
    and step_order = v_next_order;

  update public.play_sessions
  set
    status = 'in_progress',
    current_step_order = v_next_order,
    updated_at = now()
  where id = p_play_session_id;

  return jsonb_build_object(
    'status', 'progressed',
    'session', (public.get_play_session_detail(p_user_id, p_play_session_id)->'session')
  );
end;
$$;

create or replace function public.get_flowstate_summary(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stats public.user_stats;
  v_diag public.user_flow_diagnostics;
  v_active_session_id uuid;
  v_active_session jsonb;
begin
  select *
  into v_stats
  from public.user_stats us
  where us.user_id = p_user_id
  limit 1;

  select *
  into v_diag
  from public.user_flow_diagnostics d
  where d.user_id = p_user_id
  limit 1;

  select ps.id
  into v_active_session_id
  from public.play_sessions ps
  where ps.user_id = p_user_id
    and ps.status in ('in_progress', 'paused')
  order by ps.updated_at desc
  limit 1;

  if v_active_session_id is not null then
    v_active_session := public.get_play_session_detail(p_user_id, v_active_session_id)->'session';
  end if;

  return jsonb_build_object(
    'stats', jsonb_build_object(
      'xpTotal', coalesce(v_stats.xp_total, 0),
      'level', coalesce(v_stats.level, 1),
      'playsCompleted', coalesce(v_stats.plays_completed, 0),
      'decisionsSaved', coalesce(v_stats.decisions_saved, 0),
      'planningMinutesSaved', coalesce(v_stats.planning_minutes_saved, 0)
    ),
    'diagnosticCompletedAt',
      case
        when v_diag.completed_at is null then null
        else to_char(v_diag.completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      end,
    'activeSession', coalesce(v_active_session, null)
  );
end;
$$;

alter table public.user_flow_diagnostics enable row level security;
alter table public.play_templates enable row level security;
alter table public.play_template_steps enable row level security;
alter table public.play_recommendations enable row level security;
alter table public.play_sessions enable row level security;
alter table public.play_session_steps enable row level security;

drop policy if exists "user_flow_diagnostics_select_self" on public.user_flow_diagnostics;
create policy "user_flow_diagnostics_select_self"
on public.user_flow_diagnostics for select
using (auth.uid() = user_id);

drop policy if exists "user_flow_diagnostics_insert_self" on public.user_flow_diagnostics;
create policy "user_flow_diagnostics_insert_self"
on public.user_flow_diagnostics for insert
with check (auth.uid() = user_id);

drop policy if exists "user_flow_diagnostics_update_self" on public.user_flow_diagnostics;
create policy "user_flow_diagnostics_update_self"
on public.user_flow_diagnostics for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "play_templates_select_authenticated" on public.play_templates;
create policy "play_templates_select_authenticated"
on public.play_templates for select
using (auth.role() = 'authenticated');

drop policy if exists "play_template_steps_select_authenticated" on public.play_template_steps;
create policy "play_template_steps_select_authenticated"
on public.play_template_steps for select
using (auth.role() = 'authenticated');

drop policy if exists "play_recommendations_select_self" on public.play_recommendations;
create policy "play_recommendations_select_self"
on public.play_recommendations for select
using (auth.uid() = user_id);

drop policy if exists "play_sessions_select_self" on public.play_sessions;
create policy "play_sessions_select_self"
on public.play_sessions for select
using (auth.uid() = user_id);

drop policy if exists "play_sessions_update_self" on public.play_sessions;
create policy "play_sessions_update_self"
on public.play_sessions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "play_session_steps_select_self" on public.play_session_steps;
create policy "play_session_steps_select_self"
on public.play_session_steps for select
using (
  exists (
    select 1
    from public.play_sessions ps
    where ps.id = play_session_id
      and ps.user_id = auth.uid()
  )
);

revoke insert, update, delete on public.play_templates from authenticated, anon;
revoke insert, update, delete on public.play_template_steps from authenticated, anon;
revoke insert, update, delete on public.play_recommendations from authenticated, anon;
revoke insert, update, delete on public.play_sessions from authenticated, anon;
revoke insert, update, delete on public.play_session_steps from authenticated, anon;

grant execute on function public.upsert_user_flow_diagnostic(uuid, text, text, text) to authenticated;
grant execute on function public.get_hero_play(uuid, text) to authenticated;
grant execute on function public.get_play_session_detail(uuid, uuid) to authenticated;
grant execute on function public.start_play_session(uuid, uuid) to authenticated;
grant execute on function public.mark_play_step_done(uuid, uuid, integer) to authenticated;
grant execute on function public.get_flowstate_summary(uuid) to authenticated;

insert into public.play_templates (
  slug,
  title,
  summary,
  focus_pillar,
  default_duration_min,
  xp_reward,
  decision_minutes_saved,
  geo_scope,
  is_active
)
values
  (
    'deep-work-90',
    'Deep Work Sprint',
    'A focused 90-minute script to complete one high-impact deliverable.',
    'deep_work',
    90,
    120,
    90,
    'global',
    true
  ),
  (
    'energy-pulse-20',
    'Energy Pulse Reset',
    'A compact 20-minute reset to lift energy and restart momentum.',
    'vitality_health',
    20,
    70,
    45,
    'global',
    true
  ),
  (
    'local-discovery-30',
    'Local Discovery Dash',
    'A 30-minute script to get outside and complete one local micro-adventure.',
    'local_discovery',
    30,
    90,
    60,
    'global',
    true
  )
on conflict (slug)
do update set
  title = excluded.title,
  summary = excluded.summary,
  focus_pillar = excluded.focus_pillar,
  default_duration_min = excluded.default_duration_min,
  xp_reward = excluded.xp_reward,
  decision_minutes_saved = excluded.decision_minutes_saved,
  geo_scope = excluded.geo_scope,
  is_active = excluded.is_active,
  updated_at = now();

delete from public.play_template_steps
where play_template_id in (
  select id
  from public.play_templates
  where slug in ('deep-work-90', 'energy-pulse-20', 'local-discovery-30')
);

with selected_templates as (
  select id, slug
  from public.play_templates
  where slug in ('deep-work-90', 'energy-pulse-20', 'local-discovery-30')
),
seed_steps as (
  select *
  from (
    values
      (
        'deep-work-90',
        1,
        'Prime Focus Setup',
        'Silence notifications, open one target task, and define a single finish line.',
        900
      ),
      (
        'deep-work-90',
        2,
        'Execution Block',
        'Work in full-screen mode and ship the core output before checking messages.',
        3300
      ),
      (
        'deep-work-90',
        3,
        'Ship and Debrief',
        'Publish your output, capture next actions, and close the loop.',
        1200
      ),
      (
        'energy-pulse-20',
        1,
        'Wake the Body',
        'Run a brisk warm-up sequence and raise your heart rate safely.',
        240
      ),
      (
        'energy-pulse-20',
        2,
        'Power Interval',
        'Complete short high-intensity intervals with controlled breathing.',
        720
      ),
      (
        'energy-pulse-20',
        3,
        'Cooldown Lock-in',
        'Stretch, hydrate, and set the next immediate action for your day.',
        240
      ),
      (
        'local-discovery-30',
        1,
        'Pick One Route',
        'Choose one nearby landmark or street loop and set a strict return time.',
        480
      ),
      (
        'local-discovery-30',
        2,
        'Move and Notice',
        'Walk the route with phone away and capture one useful local insight.',
        900
      ),
      (
        'local-discovery-30',
        3,
        'Log the Win',
        'Return, log what you found, and choose your next execution block.',
        420
      )
  ) as t(slug, step_order, title, instruction, duration_sec)
)
insert into public.play_template_steps (
  play_template_id,
  step_order,
  title,
  instruction,
  duration_sec
)
select
  st.id,
  ss.step_order,
  ss.title,
  ss.instruction,
  ss.duration_sec
from selected_templates st
join seed_steps ss
  on ss.slug = st.slug
order by st.slug, ss.step_order;
