-- Additive migration: Fix quiz submission weak_topics_identified type mismatch (jsonb column receiving text[])
create or replace function public.submit_quiz_run(p_quiz_id uuid,p_answers jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.quiz_runs; q jsonb; a jsonb; evaluations jsonb='[]'; weak jsonb='[]'; good integer=0; total integer; score integer; result_id uuid=gen_random_uuid(); result_doc jsonb; stamp timestamptz=now(); correct boolean;
begin
 select * into r from public.quiz_runs where id=p_quiz_id and profile_id=auth.uid() for update;
 if not found then raise exception 'Quiz not found'; end if;
 if r.result is not null then return r.result; end if;
 total=jsonb_array_length(r.questions);
 if jsonb_array_length(p_answers)<>total or (select count(distinct value->>'question_id') from jsonb_array_elements(p_answers))<>total then raise exception 'Submit one answer for every question'; end if;
 for q in select value from jsonb_array_elements(r.questions) loop
   select value into a from jsonb_array_elements(p_answers) where value->>'question_id'=q->>'id';
   if a is null then raise exception 'Missing answer'; end if;
   correct=lower(trim(coalesce(a->>'user_answer','')))=lower(trim(q->>'correct_answer'));
   if correct then good=good+1;
   else
     if not weak @> jsonb_build_array(q->>'topic_title') then weak=weak || jsonb_build_array(q->>'topic_title'); end if;
     if q->>'topic_id' is not null then update public.topics set is_weak=true where id=(q->>'topic_id')::uuid; end if;
   end if;
   evaluations=evaluations || jsonb_build_array(jsonb_build_object('question_id',q->>'id','question',q->>'question','user_answer',coalesce(a->>'user_answer',''),'correct_answer',q->>'correct_answer','explanation',q->>'explanation','topic_id',q->>'topic_id','topic_title',q->>'topic_title','is_correct',correct));
 end loop;
 score=round(good*100.0/total);
 insert into public.quiz_results(id,profile_id,subject_id,topic_id,score,total_questions,correct_answers,weak_topics_identified,created_at) values(result_id,auth.uid(),r.subject_id,r.topic_id,score,total,good,weak,stamp);
 result_doc=jsonb_build_object('quiz_result_id',result_id,'subject_id',r.subject_id,'topic_id',r.topic_id,'score',score,'total_questions',total,'correct_answers',good,'passed',score>=60,'weak_topics_identified',weak,'question_evaluations',evaluations,'created_at',stamp);
 update public.quiz_runs set result=result_doc where id=r.id;
 return result_doc;
end $$;

revoke all on function public.submit_quiz_run(uuid,jsonb) from public;
grant execute on function public.submit_quiz_run(uuid,jsonb) to authenticated;
