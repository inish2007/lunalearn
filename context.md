# context.md — LunaLearn Full-Stack Integration & Architecture Status

> **LIVING SOURCE OF TRUTH (MANDATORY UPDATE RULE):**  
> Per project rule (`.agents/rules/always-update-context.md`), this file must **always be updated** on every code change, feature integration, bug fix, upstream merge, or environment transition.

---

## 1. Executive Summary & System Health

- **Current Runtime Status:**
  - **Backend Server:** Running on `http://localhost:4000` (`npm run dev`). Health checks, auth, CRUD, RAG, and planning endpoints active.
  - **Frontend Client:** Running on `http://localhost:3000` (`npm run dev`). Dashboard, workspace, and all 18 pages serve `HTTP 200 OK`.
- **Frontend Build & Types:** `next build` passes cleanly (`Compiled successfully`), 18/18 static pages prerendered with 0 type errors and 0 lint warnings.
- **Backend Build & Tests:** `npm run typecheck` (`tsc --noEmit`) passes with 0 errors. Full test suite (`npm test`) passes across all 10 suites (auth, CRUD, engine, planner, RAG Phase 1 & 2, assistant, quiz, and reactive feedback loop).
- **Backend / Infra Blocker Status:** **RESOLVED.** The backend includes `LocalDevStore` (in-memory + file-backed at `backend/scratch/local-db.json`) which automatically activates when placeholder Supabase credentials are used, simulating full row-level security (RLS) and auth. Live Supabase is seamlessly used when real credentials are provided.
- **AI/RAG Pipeline:** **ACTIVE & GROUNDED.** End-to-end PDF upload (`multipart/form-data`), text extraction (`pdf-parse`), vector embeddings (`Google Gemini`), semantic search, grounded AI assistant chat, and dynamic quiz generation are fully wired and verified.
- **Design System:** **INTEGRATED.** "Midnight Lunar Library" (dark) and "Daylight Lavender" (light) design systems with smooth velvet transitions, CSS variables, `ThemeContext` persistence, and header `ThemeToggle`.
- **Git & Remote Tracking:** Synchronized with `origin/main` (`https://github.com/inish2007/lunalearn.git`); deployment and audit status tracked in `.status.md`.

---

## 2. Feature & Endpoint Wire-Up Matrix

| Action / View | Endpoint & Service | Implementation Status |
|---|---|---|
| **Sign up / Log in / Session** | `POST /api/auth/signup`<br>`POST /api/auth/login`<br>`GET /api/auth/me` | ✅ **Active & Verified.** Authenticated tokens (`local-dev-jwt-<uuid>`) or Supabase JWTs persist in `AcademicContext`. |
| **Subjects CRUD** | `GET/POST /api/subjects`<br>`DELETE /api/subjects/:id` | ✅ **Active & Refetches.** Cascade deletes child units, topics, tasks, exams, materials. |
| **Units & Topics CRUD** | `GET/POST /api/units`<br>`GET/POST /api/topics`<br>`PATCH /api/topics/:id` | ✅ **Active & Refetches.** Hierarchical ownership checks strictly enforced. Topic completion immediately updates readiness. |
| **Exams & Risk Calculations** | `GET/POST /api/exams`<br>`DELETE /api/exams/:id` | ✅ **Active & Refetches.** Exams within 3 days with unfinished syllabus trigger `HIGH_EXAM_RISK`. |
| **Tasks & Deadline Tracking** | `GET/POST /api/tasks`<br>`PATCH/DELETE /api/tasks/:id` | ✅ **Active & Refetches.** Assignments due in <24 hours trigger `DEADLINE_RISK`. Completing task clears risk. |
| **Readiness & Risks Engine** | `GET /api/readiness/:subjectId`<br>`GET /api/risks/:subjectId` | ✅ **Active & Dynamic.** Real-time calculation from topic completion, quiz accuracy, and deadlines. |
| **Adaptive Study Planner** | `GET /api/planner/context/:subjectId` | ✅ **Active & Reactive.** Synthesizes readiness, active risks, weak topics, and upcoming exams into daily guidance with capacity constraint checking (`CONSTRAINT_CONFLICT`). |
| **Material Upload (Real PDF)** | `POST /api/rag/upload`<br>`GET/DELETE /api/materials` | ✅ **Active & Processed.** Real PDF binary file picker in `Workspace.tsx` uploads via `multipart/form-data`, extracts text, chunks, embeds, and indexes. |
| **AI Study Assistant** | `POST /api/assistant/chat` | ✅ **Active & Grounded.** Semantic vector retrieval searches PDF chunks and returns cited answers (`AssistantSourceChunk`). |
| **Grounded Quiz Generation** | `POST /api/quiz/generate` | ✅ **Active & Grounded.** Generates 5 multiple-choice questions grounded in uploaded course materials. |
| **Quiz Submission & Scoring** | `POST /api/quiz/submit` | ✅ **Active & Verified.** Evaluates student answers, detects weak topics, writes results to database, and feeds directly into readiness engine. |

---

## 3. Architecture & Data Flow

```mermaid
graph TD
    User([Student / Browser]) -->|UI Interaction| Frontend[Next.js App Router]
    Frontend -->|Theme State| ThemeContext[ThemeContext: Midnight / Lavender]
    Frontend -->|Auth & Academic State| AcademicContext[AcademicContext]
    AcademicContext -->|REST API Requests| Backend[Node.js / Express Server :4000]

    Backend -->|Routing & Validation| ZodSchemas[Zod Schema Validation]
    Backend -->|Storage & RLS| StoreSelector{Supabase Configured?}
    StoreSelector -->|Yes| SupabaseClient[Live Supabase + pgvector]
    StoreSelector -->|No / Placeholder| LocalDevStore[LocalDevStore: scratch/local-db.json]

    Backend -->|PDF Parsing| PDFParse[pdf-parse Extraction]
    Backend -->|Embeddings & Chat| GeminiAPI[Google Gemini API]
    Backend -->|Academic Engine| Engine[Readiness, Risk & Planner Engine]

    Engine --> AcademicContext
    GeminiAPI --> AcademicContext
```

---

## 4. Key Subsystems & Implementations

### A. Local Dev Store & Offline Fallback (`backend/src/lib/local-store.ts`)
- Automatically detects placeholder credentials (`SUPABASE_URL=https://your-project-ref.supabase.co`) or network failures.
- Emulates Supabase's fluent table API (`.from().select().eq().order()`, etc.) backed by `backend/scratch/local-db.json`.
- Enforces user-scoped Row Level Security (RLS) and hierarchical parent-child ownership validation (e.g. users cannot manipulate topics under other users' subjects).
- Pre-seeded with canonical demo profile:
  - **Email:** `aarav.patel@example.com`
  - **Password:** `password123`
  - **Course:** Database Management Systems (DBMS)

### B. AI/RAG Pipeline (`backend/src/services/`)
- **PDF Upload (`rag-material.service.ts`):** Parses binary multipart buffers via `busboy` and extracts plaintext using `pdf-parse`.
- **Chunking & Embeddings (`embedding.service.ts`):** Generates 1536-dimensional vectors via Gemini embeddings. Fails cleanly on rate limits to prevent vector space contamination.
- **Grounding & Chat (`assistant.service.ts` / `study-assistant.service.ts`):** Retrieves top-k matching chunks with cosine similarity > 0.65 and feeds citations directly into Gemini 1.5 chat prompts with escaped untrusted document boundaries.
- **Diagnostic Quizzes (`quiz.service.ts`):** Generates questions directly grounded in uploaded documents and analyzes incorrect options to pinpoint weak topics.

### C. Frontend Design System & Theme Engine
- **Themes:** "Midnight Lunar Library" (default cozy dark mode) and "Daylight Lavender" (crisp light mode).
- **Theme Provider:** `frontend/lib/context/ThemeContext.tsx` handles `localStorage` synchronization with zero hydration flicker.
- **Toggle Component:** `frontend/components/ThemeToggle.tsx` provides an animated Sun/Moon toggle with celestial glows.
- **Async Resilience:** Includes `AcademicDataSkeleton` and `AcademicDataErrorBanner` with graceful retry triggers.
- **Spec Documentation:** Detailed design tokens and philosophy documented in `DESIGN.md` and `design-context.md`.

---

## 5. Development Notes & Troubleshooting

### Next.js Dev Server vs. Production Build Cache
- When running `npm run build` followed by `npm run dev`, older client browser tabs may request outdated chunk hashes (e.g. `_next/static/chunks/main-app.js?v=...`), resulting in momentary 404s in the dev console until the tab refreshes.
- Hard-refreshing the browser (`Ctrl+F5` or `Cmd+Shift+R`) loads the newly compiled dev modules immediately.
- If necessary, clearing `.next/` (`rm -rf .next` or `Remove-Item -Recurse -Force .next`) resets all cached chunks.

---

## 6. Verification & Audit History

1. **Backend Domain CRUD & Security Audit:**
   - Script: `backend/src/scripts/comprehensive-audit.ts`
   - **Result:** **97 / 97 assertions PASSED (0 failures)** covering Auth, Subjects, Units, Topics, Tasks, Exams, Materials, RLS isolation, and cascade deletes.
2. **AI/RAG Real HTTP Endpoints Audit:**
   - Script: `backend/src/scripts/verify-airag-endpoints.ts`
   - **Result:** **50 / 50 assertions PASSED (0 failures)** covering PDF multipart upload, chunking, embeddings, vector search, assistant chat citations, quiz generation, quiz scoring, and dynamic planner feedback loop.
3. **Frontend Production Build:**
   - Command: `npm run build` in `frontend/`
   - **Result:** **18 / 18 routes compiled and prerendered statically** with 0 errors.

---

## 7. How to Run Locally

### Running the Backend:
```bash
cd backend
npm install
npm run seed     # Seeds demo user and DBMS course
npm run dev      # Boots backend server on http://localhost:4000
```

### Running the Frontend:
```bash
cd frontend
npm install
npm run dev      # Boots Next.js on http://localhost:3000
```

## Real-data improvement execution (2026-10-06)
The earlier health/audit statements above describe historical verification, not proof of the current environment. Approved PLAN.md now governs phased delivery; layered-build-plan.md preserves the original guide.
### Phase 1
Readiness exposes actual input counts, latest-10 quiz sample and rolling seven-day session basis. Exams and Dashboard show explanations. Shared readiness/planner types and CONTRACTS updated. Backend typecheck and frontend typecheck checked for this phase. Live provider/storage verification remains pending.

### Phase 2
Actual local PDF bytes now persist, with scoped path checks and authenticated content retrieval. My Materials opens an in-app preview/download dialog. Missing legacy originals request re-upload. Both typechecks passed; isolated storage/formula tests added. Live Supabase remains unverified.

### Phase 3: assistant Markdown, material scope, preserved PDF citations, and truthful circuit-breaker fallback implemented. OCR design saved in docs/OCR-PLAN.md only. Markdown libraries added; raw HTML disabled.
