# LunaLearn Project Context

Updated 2026-10-05 after the production-hardening audit fixes. This file summarizes the current architecture, verified behavior, recent commits, and remaining setup requirements.

## Product and architecture

LunaLearn connects a student's real subjects, topics, materials, tasks, exams, quizzes, and study activity to readiness/risk calculations and study recommendations. The product rule is real-data-first: start empty, show honest loading/error/empty states, and never present fabricated data or AI output as real.

- Frontend: Next.js 14 App Router, React 18, TypeScript, Tailwind (`frontend/`).
- Backend: Node/TypeScript routes, services, middleware, and domain types (`backend/src/`).
- Data and auth: Supabase Postgres/Auth/Storage with RLS and pgvector.
- AI: Gemini is the required provider for embeddings, assistant answers, and generated quizzes/plans. Offline/deterministic responses must remain explicitly identified as fallbacks.
- `CONTRACTS.md` is authoritative for shared API shapes and is updated when a contract changes.

## Current status

- Backend Phases 1–6 and the core academic loop are implemented. The deterministic engine computes readiness and reasoned risks from current records; planner context aggregates availability, exams, weak/unfinished topics, tasks, quizzes, readiness, and risks.
- The frontend is integrated with the backend. The latest `frontend` production build passed with TypeScript checks and all 18 routes generated.
- Backend `npm run typecheck` and `npm test` passed during the recent hardening work. RAG ingestion, assistant, quiz, and reactive-loop regression suites include the latest security fixes.
- API-driven data remains authoritative. The frontend distinguishes AsyncState loading/retrying/error from a true empty state and offers retry actions for failed requests.

## Recent security fixes

1. **Embeddings and RAG ingestion:** Gemini embedding failures no longer substitute deterministic vectors. Provider calls retry with backoff; exhausted 429s return a typed rate-limit error. A failed chunk batch marks its job `FAILED` with the Postgres message and throws an internal error.
2. **Prompt injection:** retrieved document preview text is HTML-escaped before entering the untrusted context block, preventing document text from closing or nesting its delimiters.
3. **Planner capacity:** profiles can store `available_hours_per_day` (2 hours is used only when unset); topics can store `estimated_study_hours`. Strict planner context preflight requires estimates for weak/unfinished topics when an exam is within 7 days and returns `CONSTRAINT_CONFLICT` (HTTP 422) if required hours exceed available capacity. It does not generate slots for an impossible schedule.
4. **Frontend async state:** Dashboard and Workspace render loading skeletons and retryable error banners instead of treating in-flight/failed data as a real empty account.
5. **AI transparency and request bounds:** Gemini-backed frontend requests have a 30-second client timeout with retry recovery. Quiz and assistant responses visibly disclose when the backend marked them as AI fallback output.
6. **Optimistic concurrency and schedule UI:** topic updates pass the cached `updated_at` as `If-Match`; 409 conflicts offer reload-latest or explicit reapply. The planner hides arbitrary subject slots when strict preflight returns `CONSTRAINT_CONFLICT` and explains how to revise the schedule.

## Important contracts and migrations

- `PATCH /api/auth/me` updates the current student's `available_hours_per_day`; `null` clears it and restores the 2-hour fallback.
- Topic create/update accepts nullable `estimated_study_hours`; planner context exposes it for unfinished/weak topics.
- `GET /api/planner/context?strict=true` performs planner feasibility checks. `CONSTRAINT_CONFLICT` is a non-retryable 422 with actionable guidance. Missing workload estimates return `INSUFFICIENT_DATA` instead of inventing time.
- Apply `backend/supabase/migrations/20261005000001_planner_capacity_constraints.sql` to the target Supabase database before relying on these new fields. Its application to a live database has not been verified here.
- The topic update API uses the existing `If-Match` / `updated_at` concurrency contract.

## Validation and environment notes

- Frontend: `cd frontend; npm run build`.
- Backend: `cd backend; npm run typecheck` and `npm test`.
- Frontend build and backend checks above passed during the latest audit work. Backend tests are local/mock-oriented and emit warnings when Supabase credentials are not configured; this is not evidence of a live Supabase integration test.
- No `backend/.env` or `frontend/.env` file was present in the workspace during this update. Do not assume live credentials or a production database connection.
- The repository is connected to `https://github.com/inish2007/lunalearn.git`; push status is tracked in `.status.md`.