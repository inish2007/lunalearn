# Person 2 — Backend / Academic Engine — Permissions

## Scope (edit freely)
/supabase/migrations/**, /lib/db/**, /app/api/** for subjects, units,
topics, tasks, exams, materials, readiness, risk; auth config/middleware.

## Read-only
/app/** (P1's UI), /lib/ai/**, /lib/planner/** (P3's)

## Can do without asking
Add/alter columns on tables not yet used elsewhere; add API routes in your
domain; install backend-only packages.

## Needs a heads-up first
Any change to an API shape P1/P3 already consumes; any change to
document_chunks (P3 depends on it directly).

## Needs approval
Dropping/renaming a column or table already in use; rotating Supabase keys
or editing shared secrets; merging to main.