begin;

select plan(9);

select has_table('public', 'cities', 'cities table exists');
select has_table('public', 'city_runtime_config', 'city runtime config table exists');
select has_function('public', 'get_bootstrap_config', array['text'], 'bootstrap rpc exists');
select has_function('public', 'upsert_user_flow_diagnostic', array['uuid', 'text', 'text', 'text'], 'flow diagnostic rpc exists');
select has_function('public', 'get_hero_play', array['uuid', 'text'], 'hero play rpc exists');

select ok(exists(select 1 from public.cities where id = 'blr'), 'blr city seeded');
select ok(exists(select 1 from public.cities where id = 'nyc'), 'nyc city seeded');
select is(public.calculate_level(0), 1, 'level floor at 1');
select ok((public.get_bootstrap_config('blr')->>'cityId') = 'blr', 'bootstrap returns blr cityId');

select * from finish();

rollback;
