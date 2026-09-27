# context.md — LunaLearn Integration Pass (Frontend Track)

Updated during the frontend end-to-end review. The frontend was just rewired from static
in-memory mocks to the live backend (`frontend/lib/api.ts` + `frontend/lib/context/
AcademicContext.tsx` are new/untracked). This document records what was inspected, what
works, what was broken, and what was handed off.

## TL;DR

- **Frontend compiles & boots.** `next build` → "Compiled successfully", 18/18 pages, no type
  or lint errors. `next dev` serves `/login` and `/dashboard` (HTTP 200).
- **Live end-to-end testing is currently blocked by the BACKEND, not the frontend.**
  `backend/.env` has placeholder Supabase credentials, so every API call returns
  `fetch failed`. See `BUGS.md` #1. Nothing can fully work against a live backend until P2
  configures a real/local Supabase.
- **Three real frontend bugs were found and fixed** (below).

## What I traced (per feature), status after fixes

| Action | Wire-up | Status |
|---|---|---|
| Sign up / Log in | `POST /api/auth/signup`, `/login`, `/auth/me` in `AcademicContext` | ✅ wired (blocked by BUGS.md #1). Fixed redirect bug (see below). |
| Add subject | `POST /subjects` (Dashboard, Learning, login onboarding) | ✅ wired + refetches |
| Add unit | `POST /units` (+ `loadUnitsAndTopics`) | ✅ wired + refetches |
| Add topic | `POST /topics` | ✅ wired + refetches |
| Add exam | `POST /exams` | ✅ wired + refetches |
| Add task | `POST /tasks` | ✅ wired + refetches |
| Toggle/delete task, delete exam, delete subject/unit/topic/material | `PATCH/DELETE` then `refreshAll()` | ✅ wired + refetches |
| View planner | `GET /planner/context` | ✅ wired (shows risks/recent activity via `refreshAll`) |
| Upload material | `POST /materials` (metadata only) | ⚠️ wired as CRUD, but no real file → see BUGS.md #3 |
| Ask AI assistant | `POST /assistant/chat` | 🐛 was a local mock — **fixed** (was never calling backend) |
| Generate quiz | `POST /quiz/generate` | 🐛 was a local mock — **fixed** (was never calling backend) |
| Submit quiz answers | `POST /quiz/submit` (then `refreshAll`) | 🐛 was a local mock — **fixed** |

## Frontend bugs FIXED

### 1. AI Assistant never called the backend (was a hardcoded reply)
- **Where:** `frontend/components/Workspace.tsx` → `Assistant()` → `send()`.
- **Root cause:** the handler appended a canned string and returned; there was **no
  `api.assistant` client and no fetch** to `POST /api/assistant/chat`.
- **Fix:** added `api.assistant.chat()` in `frontend/lib/api.ts`; rewired `send()` to post
  `{ message, subject_id, material_id, conversation_history }`, render the real `answer`,
  show a `⚠️ <error>` bubble and disable the button while in flight.

### 2. Quizzes never called the backend (was a single hardcoded question + `alert`)
- **Where:** `Workspace.tsx` → `Quizzes()`.
- **Root cause:** "Begin quiz" just flipped a local boolean and the only question was a
  hardcoded string; nothing hit `/api/quiz/generate` or `/api/quiz/submit`.
- **Fix:** added `api.quiz.generate()` and `api.quiz.submit()` in `api.ts`; rewired the
  component to fetch a real quiz, collect answers per question, submit, show score + weak
  topics + per-question evaluations, and call `refreshAll()` afterward so dashboard
  readiness updates without a manual reload.

### 3. Login sent returning users into the empty onboarding wizard
- **Where:** `frontend/app/login/page.tsx` → `handleAuth()`.
- **Root cause:** it decided onboarding vs. dashboard from the `subjects.length === 0`
  check, but that `subjects` value is the **stale closure** captured before `await login()`
  finished, so it was *always* empty after auth (a state-update-doesn't-re-render bug).
- **Fix:** always `router.push('/dashboard')` after auth; the Dashboard already renders a
  dedicated "add your first subject" empty state for brand-new users, so onboarding still
  happens naturally on the workspace.

### Supporting changes
- Added missing types to `frontend/lib/types/academic.ts`
  (`AssistantChatResponseData`, `AssistantSourceChunk`, `GenerateQuizResponseData`,
  `SubmitQuizResponseData`, `QuizQuestion`, etc.) aligned to the backend contract.
- Cleaned up now-unused vars in `login/page.tsx` so the project still typechecks.

## Verified NOT bugs (do not "fix")
- `window.matchMedia(...)` is the real `Window.matchMedia()` API — correct.
- Frontend CRUD bodies match the backend Zod schemas (`backend/src/types/domain.ts`).

## Handed off
- All backend/AI-RAG-caused breakage is in **`BUGS.md`** (Supabase placeholder creds =
  blocker; Gemini key format; upload-material real-pipeline wiring).

## To run the demo once Supabase is configured (see BUGS.md #1)
```
# backend
cd backend && npm install && npm run seed && npm run dev   # :4000
# frontend
cd frontend && npm run build # or npm run dev               # :3000
```