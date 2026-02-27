begin;

select plan(19);

select has_table('public', 'user_flow_diagnostics', 'user_flow_diagnostics exists');
select has_table('public', 'play_templates', 'play_templates exists');
select has_table('public', 'play_template_steps', 'play_template_steps exists');
select has_table('public', 'play_recommendations', 'play_recommendations exists');
select has_table('public', 'play_sessions', 'play_sessions exists');
select has_table('public', 'play_session_steps', 'play_session_steps exists');

select has_function('public', 'upsert_user_flow_diagnostic', array['uuid', 'text', 'text', 'text'], 'upsert_user_flow_diagnostic rpc exists');
select has_function('public', 'get_hero_play', array['uuid', 'text'], 'get_hero_play rpc exists');
select has_function('public', 'start_play_session', array['uuid', 'uuid'], 'start_play_session rpc exists');
select has_function('public', 'get_play_session_detail', array['uuid', 'uuid'], 'get_play_session_detail rpc exists');
select has_function('public', 'mark_play_step_done', array['uuid', 'uuid', 'integer'], 'mark_play_step_done rpc exists');
select has_function('public', 'get_flowstate_summary', array['uuid'], 'get_flowstate_summary rpc exists');

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
values (
  '55555555-5555-4555-8555-555555555555',
  'authenticated',
  'authenticated',
  'flowstate_test@passportquest.local',
  'not_used',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

create temporary table flow_ctx as
select
  '55555555-5555-4555-8555-555555555555'::uuid as user_id,
  public.upsert_user_flow_diagnostic(
    '55555555-5555-4555-8555-555555555555'::uuid,
    'balanced',
    'deep_work',
    'procrastination'
  ) as diagnostic_json;

select is(
  (select diagnostic_json->>'status' from flow_ctx),
  'saved',
  'diagnostic upsert returns saved'
);

select ok(
  (public.get_hero_play((select user_id from flow_ctx), null)->>'status') = 'ready',
  'hero play is available after diagnostic'
);

select is(
  (
    public.start_play_session(
      (select user_id from flow_ctx),
      gen_random_uuid()
    )->>'status'
  ),
  'recommendation_not_found',
  'start_play_session returns recommendation_not_found for unknown recommendation'
);

select ok(
  (
    with hero as (
      select public.get_hero_play((select user_id from flow_ctx), null) as payload
    ),
    started as (
      select public.start_play_session(
        (select user_id from flow_ctx),
        ((select payload->'heroPlay'->>'recommendationId' from hero))::uuid
      ) as payload
    ),
    step1 as (
      select public.mark_play_step_done(
        (select user_id from flow_ctx),
        ((select payload->'session'->>'sessionId' from started))::uuid,
        1
      ) as payload
    ),
    step2 as (
      select public.mark_play_step_done(
        (select user_id from flow_ctx),
        ((select payload->'session'->>'sessionId' from started))::uuid,
        2
      ) as payload
    ),
    step3 as (
      select public.mark_play_step_done(
        (select user_id from flow_ctx),
        ((select payload->'session'->>'sessionId' from started))::uuid,
        3
      ) as payload
    )
    select (select payload->>'status' from started) = 'started'
      and (select payload->>'status' from step1) = 'progressed'
      and (select payload->>'status' from step2) = 'progressed'
      and (select payload->>'status' from step3) = 'completed'
  ),
  'play session progresses through all three steps'
);

select is(
  (
    public.mark_play_step_done(
      (select user_id from flow_ctx),
      gen_random_uuid(),
      1
    )->>'status'
  ),
  'not_found',
  'mark_play_step_done returns not_found for unknown session'
);

select is(
  (
    public.get_play_session_detail(
      (select user_id from flow_ctx),
      gen_random_uuid()
    )->>'status'
  ),
  'not_found',
  'get_play_session_detail returns not_found for unknown session'
);

select ok(
  (
    public.get_flowstate_summary((select user_id from flow_ctx))->'stats'->>'playsCompleted'
  )::integer >= 1,
  'flowstate summary increments playsCompleted'
);

select * from finish();

rollback;
