create table public.xp_events (
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade,
 activity_key text not null, amount integer not null check(amount>=0), local_day date, created_at timestamptz not null default now(), unique(profile_id,activity_key)
);
alter table public.xp_events enable row level security;
create policy xp_read on public.xp_events for select using(profile_id=auth.uid());
alter table public.study_sessions add column if not exists local_day date;

create function public.award_activity_xp(p_profile uuid,p_key text,p_amount integer,p_day date default null) returns void
language plpgsql security definer set search_path=public as $$
declare used integer;
begin
 perform 1 from public.profiles where id=p_profile for update;
 if p_key like 'session:%' then
   select coalesce(sum(amount),0) into used from public.xp_events where profile_id=p_profile and activity_key like 'session:%' and local_day=p_day;
   p_amount=greatest(0,least(p_amount,24-used));
 end if;
 insert into public.xp_events(profile_id,activity_key,amount,local_day) values(p_profile,p_key,p_amount,p_day) on conflict do nothing;
 update public.profiles set xp=(select coalesce(sum(amount),0) from public.xp_events where profile_id=p_profile),level=1+(select coalesce(sum(amount),0)/500 from public.xp_events where profile_id=p_profile) where id=p_profile;
end $$;
revoke all on function public.award_activity_xp(uuid,text,integer,date) from public;

create function public.activity_xp_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid;
begin
 if TG_TABLE_NAME='topics' then
  if new.status='completed' and new.title not in ('Core Concepts & Terminology','Applied Systems & Practice') then
   select s.profile_id into owner_id from public.units u join public.subjects s on s.id=u.subject_id where u.id=new.unit_id;
   perform public.award_activity_xp(owner_id,'topic:'||new.id,50);
  end if;
 elsif TG_TABLE_NAME='quiz_runs' then
   if new.result is not null then perform public.award_activity_xp(new.profile_id,'quiz:'||new.id,round((new.result->>'score')::numeric/5)::integer); end if;
 elsif TG_TABLE_NAME='study_sessions' then
   if new.ended_at is not null and new.ended_at<=now() then perform public.award_activity_xp(new.profile_id,'session:'||new.id,floor(new.duration_minutes/5.0)::integer,coalesce(new.local_day,new.started_at::date)); end if;
 end if;
 return new;
end $$;
create trigger topic_xp after insert or update on public.topics for each row execute function public.activity_xp_trigger();
create trigger quiz_xp after update on public.quiz_runs for each row execute function public.activity_xp_trigger();
create trigger session_xp after insert on public.study_sessions for each row execute function public.activity_xp_trigger();

create function public.log_study_session(p_session jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare saved public.study_sessions; start_time timestamptz=(p_session->>'started_at')::timestamptz; end_time timestamptz=(p_session->>'ended_at')::timestamptz;
begin
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into saved from public.study_sessions where id=(p_session->>'id')::uuid and profile_id=auth.uid();
 if found then return to_jsonb(saved); end if;
 if end_time>now() or end_time-start_time<interval '1 minute' then raise exception 'Invalid session times'; end if;
 if not exists(select 1 from public.subjects where id=(p_session->>'subject_id')::uuid and profile_id=auth.uid()) then raise exception 'Subject not found'; end if;
 if p_session->>'topic_id' is not null and not exists(select 1 from public.topics t join public.units u on u.id=t.unit_id where t.id=(p_session->>'topic_id')::uuid and u.subject_id=(p_session->>'subject_id')::uuid) then raise exception 'Topic does not belong to subject'; end if;
 if exists(select 1 from public.study_sessions where profile_id=auth.uid() and started_at<end_time and coalesce(ended_at,started_at)>start_time) then raise exception 'This session overlaps an existing session'; end if;
 insert into public.study_sessions(id,profile_id,subject_id,topic_id,duration_minutes,session_type,notes,started_at,ended_at,local_day)
 values((p_session->>'id')::uuid,auth.uid(),(p_session->>'subject_id')::uuid,(p_session->>'topic_id')::uuid,floor(extract(epoch from end_time-start_time)/60),coalesce(p_session->>'session_type','focus'),p_session->>'notes',start_time,end_time,(start_time at time zone coalesce(p_session->>'timezone','UTC'))::date) returning * into saved;
 return to_jsonb(saved);
end $$;
revoke all on function public.log_study_session(jsonb) from public;
grant execute on function public.log_study_session(jsonb) to authenticated;

-- Idempotent backfill: only real completed topics and completed timestamped sessions.
do $$ declare rec_topic record; rec_session record; begin
 for rec_topic in select top.id, sub.profile_id from public.topics top join public.units u on u.id=top.unit_id join public.subjects sub on sub.id=u.subject_id where top.status='completed' and top.title not in ('Core Concepts & Terminology','Applied Systems & Practice') loop
 perform public.award_activity_xp(rec_topic.profile_id,'topic:'||rec_topic.id,50); end loop;
 for rec_session in select * from public.study_sessions where ended_at is not null and ended_at<=now() and ended_at>started_at order by started_at loop
 perform public.award_activity_xp(rec_session.profile_id,'session:'||rec_session.id,floor(rec_session.duration_minutes/5.0)::integer,coalesce(rec_session.local_day,rec_session.started_at::date)); end loop;
end $$;
