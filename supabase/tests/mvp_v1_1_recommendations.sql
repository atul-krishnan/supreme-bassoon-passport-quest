begin;

select plan(23);

select has_table('public', 'trip_context_sessions', 'trip_context_sessions table exists');
select has_table('public', 'quest_experience_tags', 'quest_experience_tags table exists');
select has_table('public', 'recommendation_feedback', 'recommendation_feedback table exists');
select has_table('public', 'saved_plans', 'saved_plans table exists');

select has_function(
  'public',
  'start_trip_context',
  array['uuid', 'text', 'text', 'integer', 'text', 'text', 'jsonb', 'jsonb'],
  'start_trip_context rpc exists'
);
select has_function(
  'public',
  'update_trip_context',
  array['uuid', 'uuid', 'text', 'integer', 'text', 'text', 'jsonb', 'jsonb'],
  'update_trip_context rpc exists'
);
select has_function(
  'public',
  'end_trip_context',
  array['uuid', 'uuid', 'text'],
  'end_trip_context rpc exists'
);
select has_function(
  'public',
  'record_recommendation_feedback',
  array['uuid', 'uuid', 'text', 'uuid', 'text', 'jsonb'],
  'record_recommendation_feedback rpc exists'
);
select has_function(
  'public',
  'save_plan',
  array['uuid', 'text', 'uuid', 'text', 'jsonb'],
  'save_plan rpc exists'
);
select has_function(
  'public',
  'get_saved_plans',
  array['uuid', 'integer', 'timestamp with time zone'],
  'get_saved_plans rpc exists'
);
select has_function(
  'public',
  'delete_saved_plan',
  array['uuid', 'text'],
  'delete_saved_plan rpc exists'
);

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
    'planner_test@passportquest.local',
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
    'planner_other@passportquest.local',
    'not_used',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
on conflict (id) do nothing;

create temporary table v1_ctx as
select
  '33333333-3333-4333-8333-333333333333'::uuid as user_id,
  (
    (public.start_trip_context(
      '33333333-3333-4333-8333-333333333333'::uuid,
      'blr',
      'couple',
      180,
      'medium',
      'balanced',
      '["romantic","food"]'::jsonb,
      '{}'::jsonb
    )->>'tripContextId')::uuid
  ) as trip_context_id;

select ok(
  exists (
    select 1
    from public.trip_context_sessions t
    where t.id = (select trip_context_id from v1_ctx)
      and t.user_id = (select user_id from v1_ctx)
      and t.status = 'active'
  ),
  'trip context starts in active state'
);

select is(
  (
    public.update_trip_context(
      (select user_id from v1_ctx),
      (select trip_context_id from v1_ctx),
      null,
      120,
      'high',
      'active',
      '["romantic"]'::jsonb,
      '{"avoidCrowds":true}'::jsonb
    )->>'status'
  ),
  'active',
  'trip context update returns active status'
);

select is(
  (
    public.end_trip_context(
      (select user_id from v1_ctx),
      (select trip_context_id from v1_ctx),
      'completed'
    )->>'status'
  ),
  'completed',
  'trip context ends successfully'
);

select is(
  (
    public.record_recommendation_feedback(
      (select user_id from v1_ctx),
      (select trip_context_id from v1_ctx),
      'plan_blr_1',
      (
        select q.id
        from public.quests q
        where q.city_id = 'blr'
        order by q.created_at asc
        limit 1
      ),
      'opened',
      '{"rank":1}'::jsonb
    )->>'status'
  ),
  'recorded',
  'recommendation feedback is recorded'
);

select is(
  (
    public.save_plan(
      (select user_id from v1_ctx),
      'plan_blr_1',
      (select trip_context_id from v1_ctx),
      'blr',
      '{"title":"Date Night"}'::jsonb
    )->>'status'
  ),
  'saved',
  'save_plan upsert works'
);

select is(
  (
    select count(*)::integer
    from public.get_saved_plans((select user_id from v1_ctx), 10, null)
  ),
  1,
  'saved plans query returns inserted plan'
);

select ok(
  exists (
    select 1
    from public.quest_experience_tags qet
    join public.quests q on q.id = qet.quest_id
    where q.city_id = 'blr'
      and q.is_active = true
  ),
  'active BLR quests have recommendation tags'
);

select public.save_plan(
  (select user_id from v1_ctx),
  concat('plan_blr_', gs::text),
  (select trip_context_id from v1_ctx),
  'blr',
  jsonb_build_object('title', concat('Plan ', gs::text))
)
from generate_series(2, 56) gs;

select is(
  (
    select count(*)::integer
    from public.saved_plans sp
    where sp.user_id = (select user_id from v1_ctx)
  ),
  50,
  'saved plans retention keeps latest 50 entries'
);

select is(
  (
    public.delete_saved_plan(
      (select user_id from v1_ctx),
      'plan_blr_56'
    )->>'status'
  ),
  'deleted',
  'delete_saved_plan deletes existing plan'
);

select is(
  (
    public.delete_saved_plan(
      (select user_id from v1_ctx),
      'plan_blr_56'
    )->>'status'
  ),
  'not_found',
  'delete_saved_plan returns not_found when plan is absent'
);

select ok(
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'trip_context_sessions'
      and p.policyname = 'trip_context_sessions_select_self'
  ),
  'trip_context_sessions select policy exists'
);

select ok(
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'saved_plans'
      and p.policyname = 'saved_plans_select_self'
  ),
  'saved_plans select policy exists'
);

select * from finish();

rollback;
