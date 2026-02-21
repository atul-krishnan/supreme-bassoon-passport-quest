begin;

select plan(16);

select has_table('public', 'user_push_tokens', 'user_push_tokens table exists');
select has_table('public', 'user_experiments', 'user_experiments table exists');
select has_function('public', 'request_friend_by_username', array['uuid', 'text'], 'request_friend_by_username rpc exists');
select has_function('public', 'get_incoming_friend_requests', array['uuid', 'text', 'integer'], 'get_incoming_friend_requests rpc exists');
select has_function('public', 'upsert_user_push_token', array['uuid', 'text', 'text', 'text'], 'upsert_user_push_token rpc exists');
select has_function('public', 'assign_experiment_variant', array['uuid', 'text', 'text'], 'assign_experiment_variant rpc exists');

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
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'pilot_a@passportquest.local',
    'not_used',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'pilot_b@passportquest.local',
    'not_used',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
on conflict (id) do nothing;

update public.profiles
set username = 'pilot_a_test'
where id = '11111111-1111-4111-8111-111111111111';

update public.profiles
set username = 'pilot_b_test'
where id = '22222222-2222-4222-8222-222222222222';

create temporary table mvp_ctx as
select
  '11111111-1111-4111-8111-111111111111'::uuid as user_a,
  '22222222-2222-4222-8222-222222222222'::uuid as user_b,
  (
    select q.id
    from public.quests q
    where q.city_id = 'blr'
      and q.title = 'Cubbon Park Morning Walk'
    limit 1
  ) as quest_id;

select is(
  (
    public.complete_quest(
      (select user_a from mvp_ctx),
      (select quest_id from mvp_ctx),
      now(),
      '{"lat":12.9763,"lng":77.5929,"accuracyM":10}'::jsonb,
      'test_evt_1',
      null
    )->>'status'
  ),
  'accepted',
  'quest completion accepted in geofence'
);

select is(
  (
    public.complete_quest(
      (select user_a from mvp_ctx),
      (select quest_id from mvp_ctx),
      now(),
      '{"lat":12.9763,"lng":77.5929,"accuracyM":10}'::jsonb,
      'test_evt_1',
      null
    )->>'status'
  ),
  'duplicate',
  'duplicate device_event_id is idempotent'
);

select is(
  (
    public.complete_quest(
      (select user_a from mvp_ctx),
      (select quest_id from mvp_ctx),
      now(),
      '{"lat":12.9763,"lng":77.5929,"accuracyM":200}'::jsonb,
      'test_evt_2',
      null
    )->>'status'
  ),
  'rejected',
  'high inaccuracy completion rejected'
);

select is(
  (
    public.request_friend_by_username(
      (select user_a from mvp_ctx),
      'pilot_b_test'
    )->>'status'
  ),
  'sent',
  'username-based friend request sent'
);

select is(
  (
    select count(*)::integer
    from public.get_incoming_friend_requests(
      (select user_b from mvp_ctx),
      'pending',
      10
    )
  ),
  1,
  'incoming pending request is visible'
);

select is(
  (
    public.accept_friend_request(
      (
        select fr.id
        from public.friend_requests fr
        where fr.sender_user_id = (select user_a from mvp_ctx)
          and fr.receiver_user_id = (select user_b from mvp_ctx)
          and fr.status = 'pending'
        order by fr.created_at desc
        limit 1
      ),
      (select user_b from mvp_ctx)
    )->>'status'
  ),
  'accepted',
  'incoming request can be accepted'
);

select ok(
  exists (
    select 1
    from public.friendships f
    where f.user_id = (select user_a from mvp_ctx)
      and f.friend_user_id = (select user_b from mvp_ctx)
  ),
  'friendship rows created after acceptance'
);

select is(
  (
    select count(*)::integer
    from public.get_incoming_friend_requests(
      (select user_b from mvp_ctx),
      'pending',
      10
    )
  ),
  0,
  'incoming pending list is cleared after acceptance'
);

select is(
  (
    public.upsert_user_push_token(
      (select user_a from mvp_ctx),
      'ExponentPushToken[test-token]',
      'ios',
      '0.1.0'
    )->>'status'
  ),
  'registered',
  'push token registration succeeds'
);

select is(
  (
    select public.assign_experiment_variant(
      (select user_a from mvp_ctx),
      'd2_nudge_holdout_v1',
      'treatment'
    )
  ),
  (
    select public.assign_experiment_variant(
      (select user_a from mvp_ctx),
      'd2_nudge_holdout_v1',
      'control'
    )
  ),
  'experiment assignment is stable across calls'
);

select * from finish();

rollback;
