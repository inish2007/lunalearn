# context.md — LunaLearn Full-Stack Integration & Architecture Status

Updated following the complete frontend, backend, AI/RAG, and design system integration passes. LunaLearn is fully wired end-to-end with zero open blockers. Both the backend (`http://localhost:4000`) and frontend (`http://localhost:3000`) run concurrently and communicate seamlessly.

---

## 1. Executive Summary & System Health

- **Frontend Compilation:** `next build` passes cleanly (`Compiled successfully`), 18/18 static pages prerendered, 0 type or lint errors.
- **Backend Type Safety & Lint:** `tsc --noEmit` passes with 0 type errors; test suite (`npm test`) passes across auth, crud, engine, planner, rag, assistant, quiz, and reactive loops.
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
- Pre-seeded with demo account:
  - **Email:** `aarav.patel@example.com`
  - **Password:** `password123`
  - **Subject:** Database Management Systems (DBMS)

### B. AI/RAG Pipeline (`backend/src/services/`)
- **PDF Upload (`rag-material.service.ts`):** Parses binary multipart buffers via `busboy` and extracts plaintext using `pdf-parse`.
- **Chunking & Embeddings (`embedding.service.ts`):** Generates 1536-dimensional vectors via Gemini embeddings. Fails cleanly on rate limits to prevent vector space contamination.
- **Grounding & Chat (`assistant.service.ts` / `study-assistant.service.ts`):** Retrieves top-k matching chunks with cosine similarity > 0.65 and feeds citations directly into Gemini 1.5 chat prompts with escaped untrusted document boundaries.
- **Diagnostic Quizzes (`quiz.service.ts`):** Generates questions directly grounded in uploaded documents and analyzes incorrect options to pinpoint weak topics.

### C. Frontend Design System & Theme Engine
- **Themes:** "Midnight Lunar Library" (default cozy dark mode) and "Daylight Lavender" (crisp light mode).
- **Theme Provider:** `frontend/lib/context/ThemeContext.tsx` handles `localStorage` synchronization with zero hydration flicker.
- **Toggle Component:** `frontend/components/ThemeToggle.tsx` provides an animated Sun/Moon toggle with celestial glows.
- **Spec Documentation:** Detailed design tokens and philosophy documented in `DESIGN.md` and `design-context.md`.

---

## 5. Verification & Audit History

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

## 6. How to Run Locally

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
