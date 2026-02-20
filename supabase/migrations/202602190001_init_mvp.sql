-- Passport Quest MVP (Bangalore-first, NYC-ready)
-- Additive v1 schema and RPC surface.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.cities (
  id text primary key,
  name text not null,
  country text not null,
  timezone text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.city_runtime_config (
  city_id text primary key references public.cities(id) on delete cascade,
  quiet_hours_json jsonb not null default '{"startLocal":"21:00","endLocal":"08:00"}'::jsonb,
  anti_cheat_json jsonb not null default '{"maxAccuracyM":65,"maxSpeedMps":50,"maxAttemptsPerMinute":12}'::jsonb,
  feature_flags_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_url text,
  home_city_id text references public.cities(id),
  created_at timestamptz not null default now(),
  constraint username_length check (char_length(username) between 3 and 32)
);

create table if not exists public.quests (
  id uuid primary key default extensions.gen_random_uuid(),
  city_id text not null references public.cities(id),
  title text not null,
  description text not null,
  category text not null,
  geofence_json jsonb not null,
  xp_reward integer not null,
  badge_key text,
  active_from timestamptz not null,
  active_to timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint quests_category_chk check (category in ('landmark', 'food', 'culture', 'transit')),
  constraint quests_xp_positive check (xp_reward > 0),
  constraint quests_geofence_shape check (
    geofence_json ? 'lat'
    and geofence_json ? 'lng'
    and geofence_json ? 'radiusM'
  )
);

create index if not exists quests_city_active_idx on public.quests(city_id, is_active, active_from, active_to);

create table if not exists public.quest_completions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  location_json jsonb not null,
  status text not null,
  rejection_reason text,
  awarded_xp integer not null default 0,
  device_event_id text not null,
  created_at timestamptz not null default now(),
  constraint quest_completions_status_chk check (status in ('accepted', 'rejected', 'duplicate')),
  constraint quest_completions_awarded_xp_chk check (awarded_xp >= 0),
  constraint quest_completions_location_shape check (
    location_json ? 'lat'
    and location_json ? 'lng'
    and location_json ? 'accuracyM'
  )
);

create unique index if not exists quest_completions_user_event_uidx
  on public.quest_completions(user_id, device_event_id);
create index if not exists quest_completions_user_occurred_idx
  on public.quest_completions(user_id, occurred_at desc);
create index if not exists quest_completions_user_received_idx
  on public.quest_completions(user_id, received_at desc);

create table if not exists public.user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp_total integer not null default 0,
  level integer not null default 1,
  streak_days integer not null default 0,
  last_active_date date,
  updated_at timestamptz not null default now(),
  constraint user_stats_non_negative check (xp_total >= 0 and level >= 1 and streak_days >= 0)
);

create table if not exists public.badges (
  key text primary key,
  name text not null,
  description text not null,
  icon_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null references public.badges(key) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, badge_key)
);

create table if not exists public.friend_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  receiver_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_requests_status_chk check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  constraint friend_requests_not_self_chk check (sender_user_id <> receiver_user_id)
);

create unique index if not exists friend_requests_unique_pending_idx
  on public.friend_requests(sender_user_id, receiver_user_id)
  where status = 'pending';

create table if not exists public.friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_user_id),
  constraint friendships_not_self_chk check (user_id <> friend_user_id)
);

create table if not exists public.activity_feed_events (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_feed_type_chk check (
    event_type in ('quest_completed', 'badge_unlocked', 'streak_updated', 'friend_connected')
  )
);

create index if not exists activity_feed_events_user_created_idx
  on public.activity_feed_events(user_id, created_at desc);

create table if not exists public.security_events (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists security_events_user_created_idx
  on public.security_events(user_id, created_at desc);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_username text;
begin
  v_default_username := concat('u_', substr(replace(new.id::text, '-', ''), 1, 20));

  insert into public.profiles (id, username, home_city_id)
  values (new.id, v_default_username, 'blr')
  on conflict (id) do nothing;

  insert into public.user_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists city_runtime_config_touch on public.city_runtime_config;
create trigger city_runtime_config_touch
before update on public.city_runtime_config
for each row execute function public.touch_updated_at();

drop trigger if exists friend_requests_touch on public.friend_requests;
create trigger friend_requests_touch
before update on public.friend_requests
for each row execute function public.touch_updated_at();

create or replace function public.calculate_level(p_xp integer)
returns integer
language sql
immutable
as $$
  select greatest(1, floor(sqrt(greatest(p_xp, 0)::numeric / 100))::integer + 1);
$$;

create or replace function public.haversine_m(
  p_lat1 double precision,
  p_lng1 double precision,
  p_lat2 double precision,
  p_lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select 2 * 6371000 * asin(
    sqrt(
      power(sin(radians((p_lat2 - p_lat1) / 2)), 2) +
      cos(radians(p_lat1)) * cos(radians(p_lat2)) *
      power(sin(radians((p_lng2 - p_lng1) / 2)), 2)
    )
  );
$$;

create or replace function public.get_nearby_quests(
  p_city_id text,
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 1200
)
returns table (
  id uuid,
  city_id text,
  title text,
  description text,
  category text,
  geofence jsonb,
  xp_reward integer,
  badge_key text,
  active_from timestamptz,
  active_to timestamptz
)
language sql
stable
as $$
  select
    q.id,
    q.city_id,
    q.title,
    q.description,
    q.category,
    q.geofence_json as geofence,
    q.xp_reward,
    q.badge_key,
    q.active_from,
    q.active_to
  from public.quests q
  where q.city_id = p_city_id
    and q.is_active = true
    and q.active_from <= now()
    and (q.active_to is null or q.active_to >= now())
    and public.haversine_m(
      p_lat,
      p_lng,
      (q.geofence_json->>'lat')::double precision,
      (q.geofence_json->>'lng')::double precision
    ) <= p_radius_m
  order by q.active_from desc
  limit 100;
$$;

create or replace function public.get_bootstrap_config(p_city_id text)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'cityId', c.id,
    'timeZone', c.timezone,
    'quietHours', crc.quiet_hours_json,
    'antiCheat', crc.anti_cheat_json,
    'featureFlags', crc.feature_flags_json
  )
  from public.cities c
  join public.city_runtime_config crc on crc.city_id = c.id
  where c.id = p_city_id
    and c.is_active = true;
$$;

create or replace function public.request_friend(
  p_sender_user_id uuid,
  p_receiver_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_request_id uuid;
  v_reverse_request_id uuid;
  v_request_id uuid;
begin
  if p_sender_user_id = p_receiver_user_id then
    return jsonb_build_object('status', 'rejected', 'reason', 'self_request');
  end if;

  if exists (
    select 1
    from public.friendships f
    where f.user_id = p_sender_user_id
      and f.friend_user_id = p_receiver_user_id
  ) then
    return jsonb_build_object('status', 'already_friends');
  end if;

  select fr.id into v_existing_request_id
  from public.friend_requests fr
  where fr.sender_user_id = p_sender_user_id
    and fr.receiver_user_id = p_receiver_user_id
    and fr.status = 'pending'
  limit 1;

  if v_existing_request_id is not null then
    return jsonb_build_object('status', 'duplicate_pending', 'requestId', v_existing_request_id);
  end if;

  select fr.id into v_reverse_request_id
  from public.friend_requests fr
  where fr.sender_user_id = p_receiver_user_id
    and fr.receiver_user_id = p_sender_user_id
    and fr.status = 'pending'
  limit 1;

  if v_reverse_request_id is not null then
    return jsonb_build_object('status', 'incoming_pending', 'requestId', v_reverse_request_id);
  end if;

  insert into public.friend_requests (sender_user_id, receiver_user_id, status)
  values (p_sender_user_id, p_receiver_user_id, 'pending')
  returning id into v_request_id;

  return jsonb_build_object('status', 'sent', 'requestId', v_request_id);
end;
$$;

create or replace function public.accept_friend_request(
  p_request_id uuid,
  p_receiver_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_user_id uuid;
begin
  update public.friend_requests
  set status = 'accepted'
  where id = p_request_id
    and receiver_user_id = p_receiver_user_id
    and status = 'pending'
  returning sender_user_id into v_sender_user_id;

  if v_sender_user_id is null then
    return jsonb_build_object('status', 'not_found_or_invalid');
  end if;

  insert into public.friendships (user_id, friend_user_id)
  values
    (p_receiver_user_id, v_sender_user_id),
    (v_sender_user_id, p_receiver_user_id)
  on conflict do nothing;

  insert into public.activity_feed_events (user_id, event_type, payload_json)
  values
    (p_receiver_user_id, 'friend_connected', jsonb_build_object('friendUserId', v_sender_user_id::text)),
    (v_sender_user_id, 'friend_connected', jsonb_build_object('friendUserId', p_receiver_user_id::text));

  return jsonb_build_object('status', 'accepted');
end;
$$;

create or replace function public.get_social_feed(
  p_user_id uuid,
  p_limit integer default 20,
  p_cursor timestamptz default null
)
returns table (
  id uuid,
  user_id uuid,
  event_type text,
  payload_json jsonb,
  created_at timestamptz
)
language sql
stable
as $$
  with actor_ids as (
    select p_user_id as user_id
    union
    select f.friend_user_id
    from public.friendships f
    where f.user_id = p_user_id
  )
  select
    e.id,
    e.user_id,
    e.event_type,
    e.payload_json,
    e.created_at
  from public.activity_feed_events e
  join actor_ids a on a.user_id = e.user_id
  where p_cursor is null or e.created_at < p_cursor
  order by e.created_at desc
  limit greatest(1, least(p_limit, 100));
$$;

create or replace function public.profile_compare(
  p_user_id uuid,
  p_friend_user_id uuid
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_me_xp integer := 0;
  v_me_level integer := 1;
  v_me_streak integer := 0;
  v_me_badges integer := 0;
  v_friend_xp integer := 0;
  v_friend_level integer := 1;
  v_friend_streak integer := 0;
  v_friend_badges integer := 0;
begin
  if not exists (
    select 1 from public.friendships f
    where f.user_id = p_user_id and f.friend_user_id = p_friend_user_id
  ) then
    return null;
  end if;

  select us.xp_total, us.level, us.streak_days
  into v_me_xp, v_me_level, v_me_streak
  from public.user_stats us
  where us.user_id = p_user_id;

  select us.xp_total, us.level, us.streak_days
  into v_friend_xp, v_friend_level, v_friend_streak
  from public.user_stats us
  where us.user_id = p_friend_user_id;

  select count(*) into v_me_badges
  from public.user_badges ub
  where ub.user_id = p_user_id;

  select count(*) into v_friend_badges
  from public.user_badges ub
  where ub.user_id = p_friend_user_id;

  return jsonb_build_object(
    'me', jsonb_build_object(
      'userId', p_user_id::text,
      'xp', coalesce(v_me_xp, 0),
      'level', coalesce(v_me_level, 1),
      'streakDays', coalesce(v_me_streak, 0),
      'badgeCount', coalesce(v_me_badges, 0)
    ),
    'friend', jsonb_build_object(
      'userId', p_friend_user_id::text,
      'xp', coalesce(v_friend_xp, 0),
      'level', coalesce(v_friend_level, 1),
      'streakDays', coalesce(v_friend_streak, 0),
      'badgeCount', coalesce(v_friend_badges, 0)
    ),
    'deltas', jsonb_build_object(
      'xp', coalesce(v_me_xp, 0) - coalesce(v_friend_xp, 0),
      'level', coalesce(v_me_level, 1) - coalesce(v_friend_level, 1),
      'streakDays', coalesce(v_me_streak, 0) - coalesce(v_friend_streak, 0),
      'badgeCount', coalesce(v_me_badges, 0) - coalesce(v_friend_badges, 0)
    )
  );
end;
$$;

create or replace function public.complete_quest(
  p_user_id uuid,
  p_quest_id uuid,
  p_occurred_at timestamptz,
  p_location jsonb,
  p_device_event_id text,
  p_request_ip inet default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.quest_completions;
  v_inserted_id uuid;
  v_quest public.quests;
  v_city_config public.city_runtime_config;
  v_accuracy double precision;
  v_lat double precision;
  v_lng double precision;
  v_distance_m double precision;
  v_reason text;
  v_rate_limit integer;
  v_speed_limit double precision;
  v_accuracy_limit double precision;
  v_previous public.quest_completions;
  v_prev_lat double precision;
  v_prev_lng double precision;
  v_seconds double precision;
  v_speed double precision;
  v_new_xp integer;
  v_new_level integer;
  v_new_streak integer;
  v_last_active date;
  v_badge_name text;
  v_badge_key text;
begin
  select *
  into v_existing
  from public.quest_completions qc
  where qc.user_id = p_user_id
    and qc.device_event_id = p_device_event_id
  limit 1;

  if found then
    select us.xp_total, us.level, us.streak_days
    into v_new_xp, v_new_level, v_new_streak
    from public.user_stats us
    where us.user_id = p_user_id;

    return jsonb_build_object(
      'status', 'duplicate',
      'awardedXp', v_existing.awarded_xp,
      'newTotals', jsonb_build_object(
        'xp', coalesce(v_new_xp, 0),
        'level', coalesce(v_new_level, 1),
        'streakDays', coalesce(v_new_streak, 0)
      )
    );
  end if;

  select *
  into v_quest
  from public.quests q
  where q.id = p_quest_id
    and q.is_active = true
    and q.active_from <= now()
    and (q.active_to is null or q.active_to >= now())
  limit 1;

  if not found then
    v_reason := 'quest_inactive';
  end if;

  if v_reason is null then
    select *
    into v_city_config
    from public.city_runtime_config c
    where c.city_id = v_quest.city_id
    limit 1;

    if not found then
      v_reason := 'city_config_missing';
    end if;
  end if;

  v_accuracy := coalesce((p_location->>'accuracyM')::double precision, 9999);
  v_lat := (p_location->>'lat')::double precision;
  v_lng := (p_location->>'lng')::double precision;

  if v_reason is null then
    v_accuracy_limit := coalesce((v_city_config.anti_cheat_json->>'maxAccuracyM')::double precision, 65);
    v_speed_limit := coalesce((v_city_config.anti_cheat_json->>'maxSpeedMps')::double precision, 50);
    v_rate_limit := coalesce((v_city_config.anti_cheat_json->>'maxAttemptsPerMinute')::integer, 12);

    if v_accuracy > v_accuracy_limit then
      v_reason := 'accuracy_too_low';
    end if;
  end if;

  if v_reason is null then
    v_distance_m := public.haversine_m(
      v_lat,
      v_lng,
      (v_quest.geofence_json->>'lat')::double precision,
      (v_quest.geofence_json->>'lng')::double precision
    );

    if v_distance_m > (v_quest.geofence_json->>'radiusM')::double precision then
      v_reason := 'outside_geofence';
    end if;
  end if;

  if v_reason is null then
    if (
      select count(*)
      from public.quest_completions qc
      where qc.user_id = p_user_id
        and qc.received_at >= now() - interval '1 minute'
    ) >= v_rate_limit then
      v_reason := 'rate_limited';
    end if;
  end if;

  if v_reason is null then
    select *
    into v_previous
    from public.quest_completions qc
    where qc.user_id = p_user_id
      and qc.status = 'accepted'
    order by qc.occurred_at desc
    limit 1;

    if found then
      v_prev_lat := (v_previous.location_json->>'lat')::double precision;
      v_prev_lng := (v_previous.location_json->>'lng')::double precision;
      v_seconds := extract(epoch from (p_occurred_at - v_previous.occurred_at));

      if v_seconds > 0 then
        v_speed := public.haversine_m(v_prev_lat, v_prev_lng, v_lat, v_lng) / v_seconds;
        if v_speed > v_speed_limit then
          v_reason := 'impossible_speed';
        end if;
      end if;
    end if;
  end if;

  insert into public.quest_completions (
    user_id,
    quest_id,
    occurred_at,
    location_json,
    status,
    rejection_reason,
    awarded_xp,
    device_event_id
  )
  values (
    p_user_id,
    p_quest_id,
    p_occurred_at,
    p_location,
    case when v_reason is null then 'accepted' else 'rejected' end,
    v_reason,
    case when v_reason is null then v_quest.xp_reward else 0 end,
    p_device_event_id
  )
  on conflict (user_id, device_event_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select *
    into v_existing
    from public.quest_completions qc
    where qc.user_id = p_user_id
      and qc.device_event_id = p_device_event_id
    limit 1;

    select us.xp_total, us.level, us.streak_days
    into v_new_xp, v_new_level, v_new_streak
    from public.user_stats us
    where us.user_id = p_user_id;

    return jsonb_build_object(
      'status', 'duplicate',
      'awardedXp', coalesce(v_existing.awarded_xp, 0),
      'newTotals', jsonb_build_object(
        'xp', coalesce(v_new_xp, 0),
        'level', coalesce(v_new_level, 1),
        'streakDays', coalesce(v_new_streak, 0)
      )
    );
  end if;

  if v_reason is not null then
    insert into public.security_events (user_id, event_type, details_json)
    values (
      p_user_id,
      'quest_completion_rejected',
      jsonb_build_object(
        'reason', v_reason,
        'questId', p_quest_id::text,
        'requestIp', coalesce(p_request_ip::text, 'unknown'),
        'location', p_location
      )
    );

    return jsonb_build_object(
      'status', 'rejected',
      'reason', v_reason
    );
  end if;

  insert into public.user_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select us.xp_total, us.level, us.streak_days, us.last_active_date
  into v_new_xp, v_new_level, v_new_streak, v_last_active
  from public.user_stats us
  where us.user_id = p_user_id
  for update;

  v_new_xp := v_new_xp + v_quest.xp_reward;
  v_new_level := public.calculate_level(v_new_xp);

  if v_last_active is null then
    v_new_streak := 1;
  elsif p_occurred_at::date = v_last_active then
    v_new_streak := v_new_streak;
  elsif p_occurred_at::date = v_last_active + 1 then
    v_new_streak := v_new_streak + 1;
  else
    v_new_streak := 1;
  end if;

  insert into public.user_stats (user_id, xp_total, level, streak_days, last_active_date, updated_at)
  values (p_user_id, v_new_xp, v_new_level, v_new_streak, p_occurred_at::date, now())
  on conflict (user_id)
  do update set
    xp_total = excluded.xp_total,
    level = excluded.level,
    streak_days = excluded.streak_days,
    last_active_date = excluded.last_active_date,
    updated_at = now();

  insert into public.activity_feed_events (user_id, event_type, payload_json)
  values (
    p_user_id,
    'quest_completed',
    jsonb_build_object(
      'questId', v_quest.id::text,
      'xpAwarded', v_quest.xp_reward,
      'cityId', v_quest.city_id
    )
  );

  v_badge_key := null;

  if v_quest.badge_key is not null then
    insert into public.user_badges (user_id, badge_key)
    values (p_user_id, v_quest.badge_key)
    on conflict do nothing;

    if found then
      v_badge_key := v_quest.badge_key;
      select b.name into v_badge_name
      from public.badges b
      where b.key = v_quest.badge_key;

      insert into public.activity_feed_events (user_id, event_type, payload_json)
      values (
        p_user_id,
        'badge_unlocked',
        jsonb_build_object(
          'badgeKey', v_badge_key,
          'badgeName', coalesce(v_badge_name, v_badge_key)
        )
      );
    end if;
  end if;

  return jsonb_build_object(
    'status', 'accepted',
    'awardedXp', v_quest.xp_reward,
    'badgeUnlocked', case
      when v_badge_key is null then null
      else jsonb_build_object('key', v_badge_key, 'name', coalesce(v_badge_name, v_badge_key))
    end,
    'newTotals', jsonb_build_object(
      'xp', v_new_xp,
      'level', v_new_level,
      'streakDays', v_new_streak
    )
  );
end;
$$;

alter table public.cities enable row level security;
alter table public.city_runtime_config enable row level security;
alter table public.profiles enable row level security;
alter table public.quests enable row level security;
alter table public.quest_completions enable row level security;
alter table public.user_stats enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.activity_feed_events enable row level security;
alter table public.security_events enable row level security;

-- Public readonly city/quest config for authenticated players.
create policy if not exists "cities_select_authenticated"
on public.cities for select
using (auth.role() = 'authenticated');

create policy if not exists "city_runtime_config_select_authenticated"
on public.city_runtime_config for select
using (auth.role() = 'authenticated');

create policy if not exists "quests_select_authenticated"
on public.quests for select
using (auth.role() = 'authenticated');

create policy if not exists "badges_select_authenticated"
on public.badges for select
using (auth.role() = 'authenticated');

create policy if not exists "profiles_select_self"
on public.profiles for select
using (auth.uid() = id);

create policy if not exists "profiles_insert_self"
on public.profiles for insert
with check (auth.uid() = id);

create policy if not exists "profiles_update_self"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy if not exists "quest_completions_select_self"
on public.quest_completions for select
using (auth.uid() = user_id);

create policy if not exists "user_stats_select_self"
on public.user_stats for select
using (auth.uid() = user_id);

create policy if not exists "user_badges_select_self"
on public.user_badges for select
using (auth.uid() = user_id);

create policy if not exists "friend_requests_participant_select"
on public.friend_requests for select
using (auth.uid() = sender_user_id or auth.uid() = receiver_user_id);

create policy if not exists "friend_requests_sender_insert"
on public.friend_requests for insert
with check (auth.uid() = sender_user_id);

create policy if not exists "friend_requests_receiver_update"
on public.friend_requests for update
using (auth.uid() = receiver_user_id)
with check (auth.uid() = receiver_user_id);

create policy if not exists "friendships_participant_select"
on public.friendships for select
using (auth.uid() = user_id or auth.uid() = friend_user_id);

create policy if not exists "activity_feed_events_friend_scope_select"
on public.activity_feed_events for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.friendships f
    where f.user_id = auth.uid()
      and f.friend_user_id = activity_feed_events.user_id
  )
);

create policy if not exists "security_events_select_self"
on public.security_events for select
using (auth.uid() = user_id);

-- Only service-role path should mutate sensitive gameplay tables.
revoke insert, update, delete on public.quest_completions from authenticated, anon;
revoke insert, update, delete on public.user_stats from authenticated, anon;
revoke insert, update, delete on public.user_badges from authenticated, anon;
revoke insert, update, delete on public.activity_feed_events from authenticated, anon;
revoke insert, update, delete on public.security_events from authenticated, anon;

grant execute on function public.get_nearby_quests(text, double precision, double precision, integer) to authenticated;
grant execute on function public.get_bootstrap_config(text) to authenticated;
grant execute on function public.get_social_feed(uuid, integer, timestamptz) to authenticated;

-- security definer functions run under owner; exposed only to authenticated role.
grant execute on function public.complete_quest(uuid, uuid, timestamptz, jsonb, text, inet) to authenticated;
grant execute on function public.request_friend(uuid, uuid) to authenticated;
grant execute on function public.accept_friend_request(uuid, uuid) to authenticated;
grant execute on function public.profile_compare(uuid, uuid) to authenticated;

insert into public.cities (id, name, country, timezone, is_active)
values
  ('blr', 'Bangalore', 'India', 'Asia/Kolkata', true),
  ('nyc', 'New York City', 'United States', 'America/New_York', true)
on conflict (id) do update set
  name = excluded.name,
  country = excluded.country,
  timezone = excluded.timezone,
  is_active = excluded.is_active;

insert into public.city_runtime_config (city_id, quiet_hours_json, anti_cheat_json, feature_flags_json)
values
  (
    'blr',
    '{"startLocal":"21:00","endLocal":"08:00"}'::jsonb,
    '{"maxAccuracyM":65,"maxSpeedMps":50,"maxAttemptsPerMinute":12}'::jsonb,
    '{"leaderboards":false,"groupQuests":false,"coupons":false,"nycLive":false}'::jsonb
  ),
  (
    'nyc',
    '{"startLocal":"21:00","endLocal":"08:00"}'::jsonb,
    '{"maxAccuracyM":65,"maxSpeedMps":50,"maxAttemptsPerMinute":12}'::jsonb,
    '{"leaderboards":false,"groupQuests":false,"coupons":false,"nycLive":false}'::jsonb
  )
on conflict (city_id) do update set
  quiet_hours_json = excluded.quiet_hours_json,
  anti_cheat_json = excluded.anti_cheat_json,
  feature_flags_json = excluded.feature_flags_json,
  updated_at = now();

insert into public.badges (key, name, description, icon_url)
values
  ('blr_first_steps', 'Bangalore First Steps', 'Complete your first Bangalore quest.', null),
  ('blr_three_quests', 'Bangalore Explorer', 'Complete any 3 Bangalore quests.', null),
  ('nyc_ready', 'NYC Ready', 'Reserved badge for NYC expansion.', null)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  icon_url = excluded.icon_url;

insert into public.quests (
  city_id,
  title,
  description,
  category,
  geofence_json,
  xp_reward,
  badge_key,
  active_from,
  active_to,
  is_active
)
values
  (
    'blr',
    'Cubbon Park Morning Walk',
    'Check in near Cubbon Park to unlock your first city stamp.',
    'landmark',
    '{"lat":12.9763,"lng":77.5929,"radiusM":120}'::jsonb,
    100,
    'blr_first_steps',
    now() - interval '1 day',
    null,
    true
  ),
  (
    'blr',
    'MG Road Coffee Stop',
    'Grab a coffee near MG Road and mark this foodie checkpoint.',
    'food',
    '{"lat":12.9757,"lng":77.6055,"radiusM":140}'::jsonb,
    120,
    null,
    now() - interval '1 day',
    null,
    true
  ),
  (
    'blr',
    'Lalbagh Culture Quest',
    'Visit Lalbagh Botanical Garden and complete this culture quest.',
    'culture',
    '{"lat":12.9507,"lng":77.5848,"radiusM":160}'::jsonb,
    150,
    'blr_three_quests',
    now() - interval '1 day',
    null,
    true
  ),
  (
    'nyc',
    'Bryant Park Staging Quest',
    'NYC staging content placeholder. Keep disabled for production.',
    'landmark',
    '{"lat":40.7536,"lng":-73.9832,"radiusM":120}'::jsonb,
    100,
    'nyc_ready',
    now() - interval '1 day',
    null,
    false
  )
on conflict do nothing;
