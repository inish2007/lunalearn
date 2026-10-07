-- Quiz answer keys and writes are backend-only. Submission remains an authenticated,
-- ownership-checked, atomic function. Never accept questions/result from clients.
revoke all on table public.quiz_runs from anon, authenticated;
grant all on table public.quiz_runs to service_role;
alter function public.submit_quiz_run(uuid,jsonb) security definer;
-- All existing function queries bind the run to auth.uid(); fixed search_path=public.
