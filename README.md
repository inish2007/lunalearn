
## Setup and environment
Use Node.js 22.13+ (or 24+) and run `npm ci` separately in `backend` and `frontend`.
Copy `backend/.env.example` to `backend/.env`, and `frontend/.env.example` to `frontend/.env.local`.
Development can use the isolated local store. Production requires real Supabase URL/anon/service keys, Gemini key, `NODE_ENV=production`, and exact comma-separated HTTPS `CORS_ORIGINS`; startup rejects missing/invalid required configuration. Never expose the service key or Gemini key to the browser. `NEXT_PUBLIC_API_URL` is the public backend `/api` URL and is embedded at frontend build time.
Local demo seeding requires developer-supplied `DEMO_EMAIL` and `DEMO_PASSWORD`; the login screen no longer embeds demo credentials or silently creates accounts. Demo seed data remains explicitly labeled.

## Migrations and tests
Apply `backend/supabase/migrations/*.sql` in filename order to a disposable Supabase project first, then to the intended project after review. The five `20261006` migrations add quiz runs, XP/session accounting, profile preferences, task estimates, and quiz-answer isolation. `20261007000001` adds ownership/date composite indexes for task/exam lists (including completion and subject filters). Existing primary keys support idempotent creation and conditional writes. No destructive schema operation is included in the hardening migration.
Backend: `npm run typecheck`, `npm run lint`, `npm test`. Frontend: `npm run build`; date fixtures: from root, `backend/node_modules/.bin/tsx frontend/scripts/test-dates.ts`.
Optional HTTP/provider scripts require the disposable `preview-fixture.ts` server. `--mock-ai` verifies contracts, never live Gemini. Live connection/provider checks require separate credentials and quota. See `HARDENING.md` for actual results and limitations.

## Deployment checklist (documentation only)
- Apply and verify migrations/RLS/storage policies on staging; verify cross-user isolation and atomic edits against actual Postgres.
- Set production secrets through the hosting secret manager; configure HTTPS frontend/API origins and build frontend with its final API URL.
- Run all checks, inspect `/health` and `/ready`, verify a real PDF/assistant/quiz flow, and test SIGTERM drain in the intended runtime.
- Put a shared rate limiter and request-size limits at the edge for multiple backend instances. The built-in limiter uses the connection address and intentionally ignores spoofable forwarding/token headers; proxies sharing one connection address share a quota.
- Configure private storage, database backups, log retention, alerts, and a rollback process. Do not deploy local store or demo accounts as production authentication.
- Review npm audit and rerun browser keyboard/mobile flows before release. No deployment is performed by these instructions.
