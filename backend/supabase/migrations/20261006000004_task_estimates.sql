alter table public.tasks add column if not exists estimated_minutes integer check(estimated_minutes is null or estimated_minutes between 1 and 10080);
