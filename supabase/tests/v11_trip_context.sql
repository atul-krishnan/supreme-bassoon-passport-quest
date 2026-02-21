begin;

select plan(24);

select has_table('public', 'user_preferences', 'user_preferences table exists');
select has_table('public', 'trip_context_sessions', 'trip_context_sessions table exists');
select has_table('public', 'quest_experience_tags', 'quest_experience_tags table exists');
select has_table('public', 'recommendation_feedback', 'recommendation_feedback table exists');

select has_function('public', 'start_trip_context', array['uuid', 'text', 'text', 'integer', 'boolean', 'text', 'text', 'text', 'integer', 'timestamp with time zone', 'jsonb', 'jsonb'], 'start_trip_context rpc exists');
select has_function('public', 'update_trip_context', array['uuid', 'uuid', 'text', 'integer', 'boolean', 'text', 'text', 'text', 'integer', 'timestamp with time zone', 'jsonb', 'jsonb'], 'update_trip_context rpc exists');
select has_function('public', 'end_trip_context', array['uuid', 'uuid', 'text'], 'end_trip_context rpc exists');
select has_function('public', 'get_recommended_quests', array['uuid', 'text', 'uuid', 'integer'], 'get_recommended_quests rpc exists');
select has_function('public', 'record_recommendation_feedback', array['uuid', 'uuid', 'uuid', 'text', 'jsonb'], 'record_recommendation_feedback rpc exists');

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '33333333-3333-4333-8333-333333333333',
    'authenticated',
    'authenticated',
    'pilot_c@passportquest.local',
    'not_used',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'authenticated',
    'authenticated',
    'pilot_d@passportquest.local',
    'not_used',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
on conflict (id) do nothing;

update public.profiles
set username = 'pilot_c_test'
where id = '33333333-3333-4333-8333-333333333333';

update public.profiles
set username = 'pilot_d_test'
where id = '44444444-4444-4444-8444-444444444444';

create temporary table v11_ctx as
select
  '33333333-3333-4333-8333-333333333333'::uuid as user_a,
  '44444444-4444-4444-8444-444444444444'::uuid as user_b,
  (
    select q.id
    from public.quests q
    where q.city_id = 'blr'
      and q.title = 'Cubbon Park Morning Walk'
    limit 1
  ) as quest_family_id,
  (
    select q.id
    from public.quests q
    where q.city_id = 'blr'
      and q.title = 'MG Road Coffee Stop'
    limit 1
  ) as quest_date_id,
  (
    public.start_trip_context(
      '33333333-3333-4333-8333-333333333333'::uuid,
      'blr',
      'family',
      3,
      true,
      'balanced',
      'medium',
      'mixed',
      180,
      now(),
      '["greenery"]'::jsonb,
      '{}'::jsonb
    )->>'tripContextId'
  )::uuid as trip_context_id,
  null::uuid as active_trip_context_id;

select ok(
  (select trip_context_id is not null from v11_ctx),
  'start context creates active row for user'
);

select is(
  (select status from public.trip_context_sessions where id = (select trip_context_id from v11_ctx)),
  'active',
  'started trip context is active'
);

select is(
  (
    public.update_trip_context(
      (select user_a from v11_ctx),
      (select trip_context_id from v11_ctx),
      null,
      null,
      null,
      'active',
      null,
      null,
      120,
      null,
      null,
      null
    )->>'pace'
  ),
  'active',
  'update context applies partial patch fields'
);

select is(
  (select time_budget_min from public.trip_context_sessions where id = (select trip_context_id from v11_ctx)),
  120,
  'time budget updated by partial patch'
);

select is(
  (select context_type from public.trip_context_sessions where id = (select trip_context_id from v11_ctx)),
  'family',
  'partial patch keeps untouched fields unchanged'
);

select is(
  (
    public.end_trip_context(
      (select user_a from v11_ctx),
      (select trip_context_id from v11_ctx),
      'completed'
    )->>'status'
  ),
  'completed',
  'end context transitions status'
);

select is(
  (select status from public.trip_context_sessions where id = (select trip_context_id from v11_ctx)),
  'completed',
  'ended context persisted as completed'
);

update v11_ctx
set active_trip_context_id = (
  public.start_trip_context(
    (select user_a from v11_ctx),
    'blr',
    'family',
    4,
    true,
    'relaxed',
    'medium',
    'car',
    240,
    now(),
    '["quiet"]'::jsonb,
    '{}'::jsonb
  )->>'tripContextId'
)::uuid;

update public.quest_experience_tags
set family_safe = true,
    kid_friendly = true,
    date_friendly = false
where quest_id = (select quest_family_id from v11_ctx);

update public.quest_experience_tags
set family_safe = false,
    kid_friendly = false,
    date_friendly = true
where quest_id = (select quest_date_id from v11_ctx);

select ok(
  (
    select count(*)
    from public.get_recommended_quests(
      (select user_a from v11_ctx),
      'blr',
      (select active_trip_context_id from v11_ctx),
      10
    )
  ) > 0,
  'recommendations return rows for active city context'
);

select ok(
  not exists (
    select 1
    from public.get_recommended_quests(
      (select user_a from v11_ctx),
      'blr',
      (select active_trip_context_id from v11_ctx),
      20
    ) r
    join public.quests q on q.id = r.quest_id
    where q.city_id <> 'blr'
      or q.is_active = false
  ),
  'recommendations return only active quests in requested city'
);

select ok(
  (
    with ranked as (
      select *
      from public.get_recommended_quests(
        (select user_a from v11_ctx),
        'blr',
        (select active_trip_context_id from v11_ctx),
        20
      )
    )
    select
      coalesce((select score from ranked where quest_id = (select quest_family_id from v11_ctx) limit 1), 0)
      >
      coalesce((select score from ranked where quest_id = (select quest_date_id from v11_ctx) limit 1), 0)
  ),
  'family/date tags affect recommendation ranking for family context'
);

select is(
  (
    public.record_recommendation_feedback(
      (select user_a from v11_ctx),
      (select active_trip_context_id from v11_ctx),
      (select quest_family_id from v11_ctx),
      'opened',
      '{"rank":1}'::jsonb
    )->>'status'
  ),
  'recorded',
  'feedback write succeeds for self'
);

create or replace function pg_temp.cross_user_feedback_fails()
returns boolean
language plpgsql
as $$
declare
  v_user_b uuid;
  v_trip_id uuid;
  v_quest_id uuid;
begin
  select user_b, active_trip_context_id, quest_family_id
  into v_user_b, v_trip_id, v_quest_id
  from pg_temp.v11_ctx;

  perform public.record_recommendation_feedback(
    v_user_b,
    v_trip_id,
    v_quest_id,
    'opened',
    '{}'::jsonb
  );

  return false;
exception
  when others then
    return position('trip_context_not_found' in sqlerrm) > 0;
end;
$$;

select ok(
  pg_temp.cross_user_feedback_fails(),
  'feedback write fails when trip context belongs to another user'
);

select set_config(
  'passportquest.test.active_trip_context_id',
  (select active_trip_context_id::text from v11_ctx),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select ok(
  exists (
    select 1
    from public.trip_context_sessions
    where id = current_setting('passportquest.test.active_trip_context_id')::uuid
  ),
  'RLS allows self access to own trip context'
);

select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select ok(
  not exists (
    select 1
    from public.trip_context_sessions
    where id = current_setting('passportquest.test.active_trip_context_id')::uuid
  ),
  'RLS blocks cross-user trip context access'
);

select ok(
  not exists (
    select 1
    from public.recommendation_feedback
    where user_id = '33333333-3333-4333-8333-333333333333'::uuid
  ),
  'RLS blocks cross-user feedback access'
);

reset role;

select * from finish();

rollback;
