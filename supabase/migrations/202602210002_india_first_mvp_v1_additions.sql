-- Passport Quest MVP v1 additive slice (India-first rollout)
-- Adds push token storage, experiments, and username-first social helpers.

create table if not exists public.user_push_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null,
  app_version text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true,
  primary key (user_id, token),
  constraint user_push_tokens_platform_chk check (platform in ('ios', 'android'))
);

create index if not exists user_push_tokens_user_last_seen_idx
  on public.user_push_tokens(user_id, last_seen_at desc);

create table if not exists public.user_experiments (
  user_id uuid not null references auth.users(id) on delete cascade,
  experiment_key text not null,
  variant text not null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, experiment_key),
  constraint user_experiments_variant_chk check (variant in ('control', 'treatment'))
);

create unique index if not exists profiles_username_lower_uidx
  on public.profiles ((lower(username)));

create or replace function public.request_friend_by_username(
  p_sender_user_id uuid,
  p_receiver_username text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receiver_user_id uuid;
  v_result jsonb;
begin
  select p.id
  into v_receiver_user_id
  from public.profiles p
  where lower(p.username) = lower(trim(p_receiver_username))
  limit 1;

  if v_receiver_user_id is null then
    return jsonb_build_object('status', 'rejected', 'reason', 'user_not_found');
  end if;

  select public.request_friend(p_sender_user_id, v_receiver_user_id)
  into v_result;

  return coalesce(v_result, jsonb_build_object('status', 'rejected', 'reason', 'unknown'));
end;
$$;

create or replace function public.get_incoming_friend_requests(
  p_user_id uuid,
  p_status text default 'pending',
  p_limit integer default 30
)
returns table (
  request_id uuid,
  sender_user_id uuid,
  sender_username text,
  sender_avatar_url text,
  created_at timestamptz,
  status text
)
language sql
stable
as $$
  select
    fr.id as request_id,
    fr.sender_user_id,
    p.username as sender_username,
    p.avatar_url as sender_avatar_url,
    fr.created_at,
    fr.status
  from public.friend_requests fr
  join public.profiles p
    on p.id = fr.sender_user_id
  where fr.receiver_user_id = p_user_id
    and fr.status = p_status
  order by fr.created_at desc
  limit greatest(1, least(p_limit, 100));
$$;

create or replace function public.upsert_user_push_token(
  p_user_id uuid,
  p_token text,
  p_platform text,
  p_app_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if p_platform not in ('ios', 'android') then
    raise exception 'invalid_platform';
  end if;

  insert into public.user_push_tokens (
    user_id,
    token,
    platform,
    app_version,
    created_at,
    last_seen_at,
    is_active
  )
  values (
    p_user_id,
    p_token,
    p_platform,
    p_app_version,
    v_now,
    v_now,
    true
  )
  on conflict (user_id, token)
  do update set
    platform = excluded.platform,
    app_version = coalesce(excluded.app_version, public.user_push_tokens.app_version),
    last_seen_at = v_now,
    is_active = true;

  return jsonb_build_object(
    'status', 'registered',
    'token', p_token,
    'platform', p_platform,
    'updatedAt', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

create or replace function public.assign_experiment_variant(
  p_user_id uuid,
  p_experiment_key text,
  p_default_variant text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variant text;
begin
  if p_default_variant not in ('control', 'treatment') then
    raise exception 'invalid_variant';
  end if;

  insert into public.user_experiments (user_id, experiment_key, variant)
  values (p_user_id, p_experiment_key, p_default_variant)
  on conflict (user_id, experiment_key) do nothing;

  select ue.variant
  into v_variant
  from public.user_experiments ue
  where ue.user_id = p_user_id
    and ue.experiment_key = p_experiment_key
  limit 1;

  return coalesce(v_variant, p_default_variant);
end;
$$;

alter table public.user_push_tokens enable row level security;
alter table public.user_experiments enable row level security;

drop policy if exists "user_push_tokens_select_self" on public.user_push_tokens;
create policy "user_push_tokens_select_self"
on public.user_push_tokens for select
using (auth.uid() = user_id);

drop policy if exists "user_experiments_select_self" on public.user_experiments;
create policy "user_experiments_select_self"
on public.user_experiments for select
using (auth.uid() = user_id);

revoke insert, update, delete on public.user_push_tokens from authenticated, anon;
revoke insert, update, delete on public.user_experiments from authenticated, anon;

grant execute on function public.request_friend_by_username(uuid, text) to authenticated;
grant execute on function public.get_incoming_friend_requests(uuid, text, integer) to authenticated;
grant execute on function public.upsert_user_push_token(uuid, text, text, text) to authenticated;
grant execute on function public.assign_experiment_variant(uuid, text, text) to authenticated;
