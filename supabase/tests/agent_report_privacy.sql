-- An agent's performance report is private to that agent (parity brief §8).
-- Run against the live project; everything is rolled back. Expected:
--   the agent themself 1, another agent 0, a client 0, anon may select: false.
-- my_performance_report() takes no agent id: it reports on auth.uid() only.
begin;
create temp table ids on commit drop as
  select (select id from public.profiles where role='agent' order by created_at limit 1) a1,
         (select id from public.profiles where role='agent' order by created_at offset 1 limit 1) a2,
         (select id from public.profiles where role<>'agent' order by created_at limit 1) c1;
grant select on ids to authenticated, anon;
create temp table out(who text, baselines bigint) on commit drop;
grant insert, select on out to authenticated, anon;
insert into public.agent_performance_baselines(agent_id, monthly_sales) select a1, 7 from ids
  on conflict (agent_id) do update set monthly_sales = 7;
select set_config('request.jwt.claims', json_build_object('sub',(select a1 from ids),'role','authenticated')::text, true);
set local role authenticated;
insert into out select 'the agent themself', (select count(*) from public.agent_performance_baselines where agent_id=(select a1 from ids));
reset role;
select set_config('request.jwt.claims', json_build_object('sub',(select a2 from ids),'role','authenticated')::text, true);
set local role authenticated;
insert into out select 'another agent', (select count(*) from public.agent_performance_baselines where agent_id=(select a1 from ids));
reset role;
select set_config('request.jwt.claims', json_build_object('sub',(select c1 from ids),'role','authenticated')::text, true);
set local role authenticated;
insert into out select 'a client', (select count(*) from public.agent_performance_baselines where agent_id=(select a1 from ids));
reset role;
insert into out select 'anon may select baselines: '||has_table_privilege('anon','public.agent_performance_baselines','select'), null;
select * from out;
rollback;
