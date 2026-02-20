begin;

select plan(8);

select has_table('public', 'cities', 'cities table exists');
select has_table('public', 'city_runtime_config', 'city runtime config table exists');
select has_function('public', 'complete_quest', array['uuid', 'uuid', 'timestamp with time zone', 'jsonb', 'text', 'inet'], 'complete_quest rpc exists');
select has_function('public', 'get_bootstrap_config', array['text'], 'bootstrap rpc exists');

select ok(exists(select 1 from public.cities where id = 'blr'), 'blr city seeded');
select ok(exists(select 1 from public.cities where id = 'nyc'), 'nyc city seeded');
select is(public.calculate_level(0), 1, 'level floor at 1');
select ok((public.get_bootstrap_config('blr')->>'cityId') = 'blr', 'bootstrap returns blr cityId');

select * from finish();

rollback;
