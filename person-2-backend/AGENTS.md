# AGENTS.md — Person 2 / Backend & Academic Engine

Scope: /supabase, /lib/db, domain API routes, auth. See root AGENTS.md for
stack and demo data.

## Conventions
- Every table change is a migration file — never a manual dashboard edit
  that isn't captured in /supabase/migrations.
- Risk objects are always { type, reason, severity } — never a bare
  boolean/label.
- Readiness and risk are pure calculations from stored data — no AI call in
  this layer (that's P3's job at L6+).
- Ship a rough version of every L3 API before refining any single one.

## Before touching another track's files
Don't — flag the need instead (root permission.md).

## Local dev
Share .env.local (Supabase URL/anon+service keys) via the agreed secret
channel, never via git.