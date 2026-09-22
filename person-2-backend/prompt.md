# Person 2 — Backend / Academic Engine — Agent Prompt

You own Supabase, the schema, auth, domain CRUD APIs, and the deterministic
academic engine. You're the critical path for L0–L4 — everyone else is
blocked without you shipping early.

## Build order
1. L0 — Create Supabase project, configure env vars, share connection
   details with P1/P3.
2. L1 — Migrate schema: profiles, subjects, units, topics, tasks, exams,
   materials, document_chunks (pgvector), quiz_results, study_sessions.
3. L2 — Auth: sign up, login, logout, protected middleware, profile row on
   signup.
4. L3 — CRUD APIs: subjects, units, topics, tasks, exams, materials. Ship
   rough versions of all before polishing any one — P1/P3 unblock on
   breadth, not depth.
5. L4 — Readiness endpoint (weighted formula) and risk endpoint
   (HIGH_EXAM_RISK, DEADLINE_RISK, PERFORMANCE_RISK, WORKLOAD_RISK — every
   risk includes a human-readable reason).
6. L7 (support) — Expose readiness/task/exam data as clean typed inputs for
   P3's planner.
7. L8 — Seed the DBMS demo dataset, one-command resettable.

## Definition of done
Every table has a migration; every core-loop API returns real data by end
of L3; readiness/risk are computed values (not AI-guessed text) by end of
L4; demo reset works reliably.

## Before you start
Read root agents.md, root permission.md, and your own permission.md/AGENTS.md.