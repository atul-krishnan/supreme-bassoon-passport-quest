-- FlowState hard cleanup: remove legacy quest/social/trip-planning schema surface.
-- This migration is intentionally idempotent for safe replays in local/dev.

-- Legacy RPCs
drop function if exists public.get_nearby_quests(text, double precision, double precision, integer);
drop function if exists public.complete_quest(uuid, uuid, timestamp with time zone, jsonb, text, inet);
drop function if exists public.get_social_feed(uuid, integer, timestamp with time zone);
drop function if exists public.request_friend(uuid, uuid);
drop function if exists public.accept_friend_request(uuid, uuid);
drop function if exists public.profile_compare(uuid, uuid);
drop function if exists public.request_friend_by_username(uuid, text);
drop function if exists public.get_incoming_friend_requests(uuid, text, integer);
drop function if exists public.start_trip_context(uuid, text, text, integer, text, text, jsonb, jsonb);
drop function if exists public.update_trip_context(uuid, uuid, text, integer, text, text, jsonb, jsonb);
drop function if exists public.end_trip_context(uuid, uuid, text);
drop function if exists public.record_recommendation_feedback(uuid, uuid, text, uuid, text, jsonb);
drop function if exists public.save_plan(uuid, text, uuid, text, jsonb);
drop function if exists public.get_saved_plans(uuid, integer, timestamp with time zone);
drop function if exists public.delete_saved_plan(uuid, text);

-- Legacy tables (drop in dependency order)
drop table if exists public.recommendation_feedback;
drop table if exists public.saved_plans;
drop table if exists public.trip_context_sessions;
drop table if exists public.quest_experience_tags;
drop table if exists public.activity_feed_events;
drop table if exists public.friendships;
drop table if exists public.friend_requests;
drop table if exists public.completion_idempotency_keys;
drop table if exists public.quest_completions;
drop table if exists public.user_badges;
drop table if exists public.badges;
drop table if exists public.quests;
