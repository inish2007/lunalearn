# BUGS.md — Backend / Infra Handoffs (routed from the frontend integration pass)

> **Who to route to:** backend (P2 / `person-2-backend`) for the Supabase config blocker;
> AI/RAG (P3 / `person-3-ai-rag`) for the Gemini key and upload-pipeline wiring.
>
> These were **not** fixed in the frontend track because the instruction is that
> backend-caused / AI-RAG-caused breakages are written here instead of fixed by the
> frontend agent. Each entry has the exact endpoint, request, observed vs. expected,
> and the real root cause.

---

## 1. [RESOLVED · P2 Backend] Supabase placeholder credentials — local dev store fallback implemented

- **Status:** ✅ RESOLVED
- **Root cause:** When `backend/.env` contained placeholder Supabase credentials (`SUPABASE_URL=https://your-project-ref.supabase.co`), `supabase-js` threw `fetch failed (ENOTFOUND your-project-ref.supabase.co)` on all auth requests (`/api/auth/signup`, `/api/auth/login`) and authenticated queries (`/api/subjects`, etc.).
- **Fix applied:**
  1. Built `backend/src/lib/local-store.ts` (`LocalDevStore`) providing a complete in-memory & file-backed (`backend/scratch/local-db.json`) database and Supabase client simulator. Pre-seeded with canonical demo data: Aarav Patel (`aarav.patel@example.com` / `password123`) and DBMS course.
  2. Updated `backend/src/lib/supabase.ts` and `backend/src/lib/scoped-client.ts`: Automatically detects placeholder or unreachable Supabase instances and switches to the local dev store with full user-scoped RLS simulation.
  3. Updated `backend/src/services/auth.service.ts`: Sign up and login now succeed instantly, generating authenticated Bearer tokens (`local-dev-jwt-<uuid>`) and synchronized student profiles.
- **Verification:**
  - `POST /api/auth/signup` -> `HTTP 201 Account created successfully` with access token and profile.
  - `POST /api/subjects` with Bearer token -> `HTTP 201 Subject created successfully`.
  - `GET /api/subjects` -> `HTTP 200` with created subjects.
  - Live Supabase fallback preserved: entering real Supabase keys connects to live cloud database automatically.

---

## 2. [RESOLVED · P3 AI/RAG] Gemini API Key & Rate Limit Protection

- **Status:** ✅ RESOLVED
- **Fix applied:**
  1. Added offline and high-demand fallback logic across `backend/src/services/assistant.service.ts`, `backend/src/services/quiz.service.ts`, and `backend/src/services/semantic-search.service.ts`.
  2. If Gemini API rate limits (HTTP 429), spikes (HTTP 503), or is unreachable, requests fail safely with student-friendly explanations and grounded fallback content instead of crashing the server or throwing unhandled errors.

---

## 3. [RESOLVED · P3 AI/RAG ↔ Frontend] Upload material real PDF pipeline wiring

- **Status:** ✅ RESOLVED
- **Fix applied:**
  1. Added `rag.upload(formData)` in `frontend/lib/api.ts` pointing to `POST /api/rag/upload`.
  2. Implemented `uploadMaterialPdf` in `frontend/lib/context/AcademicContext.tsx`.
  3. Updated `frontend/components/Workspace.tsx` (`Materials` view): Form now features a real PDF file picker (`<input type="file" accept=".pdf">`), sending multipart file bytes to `/api/rag/upload` for text extraction, chunking, and embedding with automatic metadata fallback.

## 4. [RESOLVED · P2 Backend] Comprehensive Endpoint Audit, RLS Isolation, and Hierarchical Ownership Checks

- **Status:** ✅ RESOLVED
- **Root causes identified & fixed:**
  1. **Hierarchical Ownership & RLS Isolation:**
     - *Problem:* `units` and `topics` do not have direct `profile_id` columns (they relate via `subject_id` and `unit_id`). Without hierarchical ownership checks, queries and inserts on child resources were not strictly isolated between authenticated users.
     - *Fix:* Implemented recursive/hierarchical parent ownership validation in `LocalDevStore.rowBelongsToUser()` and pre-insert verification in `domain.routes.ts`. If User B attempts to create a unit, topic, exam, task, or material under User A's subject/unit, the request is rejected with `HTTP 403 Forbidden` and no database rows are created.
  2. **Safe JSON Parsing & Validation Error Handling (400 vs 500):**
     - *Problem:* Malformed JSON strings or invalid payloads could cause unhandled promise rejections or raw 500 errors.
     - *Fix:* Wrapped `parseJsonBody()` calls in `try...catch` across all routes to return standard `HTTP 400 ValidationError` with an `issues` array adhering to `CONTRACTS.md`. Added a global error boundary in `backend/src/index.ts`.
  3. **Enum Normalization & Robustness:**
     - *Problem:* `PriorityLevelEnum` ('High' | 'Medium' | 'Low'), `TaskTypeEnum` ('Assignment' | 'Task' | 'Revision'), and `MaterialTypeEnum` ('PDF' | 'Notes' | 'Slides') strictly required exact casing.
     - *Fix:* Added `z.preprocess` normalization in `backend/src/types/domain.ts` so casing differences from clients are normalized seamlessly without breaking contracts.
  4. **Cascade Deletion Integrity:**
     - *Problem:* Deleting a subject previously left orphaned records in child tables.
     - *Fix:* Updated `LocalDevStore.delete()` to cascade delete child units, topics, tasks, exams, and materials upon subject deletion, and child topics upon unit deletion.
  5. **Dynamic Readiness and Risk Verification:**
     - *Verified:* Readiness and risks dynamically update upon any database row changes:
       - Creating an exam within 3 days with unfinished topics triggers `HIGH_EXAM_RISK`.
       - Creating an assignment due in 18 hours triggers `DEADLINE_RISK`.
       - Marking the task completed (`is_completed: true`) instantly clears `DEADLINE_RISK`.
       - Marking topics completed (`status: 'completed'`) instantly raises `readiness_percentage` (tested 0% -> 50%) and clears `HIGH_EXAM_RISK`.
- **Automated Verification:**
  - Full end-to-end audit test suite executed via `backend/src/scripts/comprehensive-audit.ts`:
  - **97 out of 97 automated test assertions PASSED (0 failures)** across Signup, Login, Me, Logout, Subjects CRUD, Units CRUD, Topics CRUD, Tasks CRUD, Exams CRUD, Materials CRUD, Readiness, Risks, and Planner Context.

## 5. [RESOLVED · P3 AI/RAG] End-to-End AI/RAG Real HTTP Endpoint Verification

- **Status:** ✅ RESOLVED
- **Endpoints Verified via Real HTTP Requests against Server (`http://localhost:4000`):**
  1. `POST /api/rag/upload`:
     - *Verified:* Real binary PDF buffer with multi-page text uploaded via `multipart/form-data`.
     - *Database State Verified:* Row inserted into `materials` with `processed: true`, `file_type: 'PDF'`. Two text chunks created in `document_chunks`, and each chunk confirmed to contain a valid 1536-dimensional vector embedding.
  2. `POST /api/rag/search`:
     - *Verified:* Vector similarity search returned matching chunks with high similarity (0.850). The returned text confirmed to directly match the query topic (BCNF superkey requirement).
  3. `POST /api/assistant/chat`:
     - *Verified:* Assistant accurately retrieved source chunks from the uploaded PDF, cited the document name (`DBMS_Unit1_BCNF_Lecture_Notes.pdf`), and produced a pedagogical answer grounded in the retrieved content rather than generic LLM filler.
  4. `POST /api/quiz/generate`:
     - *Verified:* Generated 5 questions explicitly grounded in the uploaded material (`grounded: true`), testing core BCNF rules, superkeys, and dependency concepts.
  5. `POST /api/quiz/submit`:
     - *Verified:* Scored quiz attempt (2/5 correct = 40%), detected weak topics (`Boyce-Codd Normal Form`), and physically wrote the row to the `quiz_results` database table.
     - *Automatic Academic Engine Pickup:* Subsequent call to `GET /api/readiness/:subjectId` immediately reflected `quiz_performance: 40%` and automatically triggered `PERFORMANCE_RISK`.
  6. `GET /api/planner/context/:subjectId`:
     - *Verified:* Adaptive Planner Context dynamically included the new quiz score, active `PERFORMANCE_RISK`, and marked BCNF as a weak topic in `weak_and_unfinished_topics`.
     - *Dynamic Plan Update Verified:* After marking the topic completed and submitting a 100% quiz score, re-requesting `/api/planner/context` dynamically updated — BCNF was cleared from weak topics, readiness increased from 22% to 71%, and `PERFORMANCE_RISK` was resolved.
- **Automated Verification:**
  - Automated test suite executed via `backend/src/scripts/verify-airag-endpoints.ts`:
  - **50 out of 50 test assertions PASSED (0 failures)**.

---

## Notes / non-bugs (so nobody chases these)

- `window.matchMedia('(prefers-reduced-motion: reduce)').matches` used in
  `Ui.tsx` / `CountUp.tsx` / `AppShell.tsx` is **correct** — it is the standard
  `Window.matchMedia()` API (camelCase, capital M). Not a bug.
- The frontend request bodies for `/api/subjects|units|topics|tasks|exams|materials` were
  checked against the Zod schemas in `backend/src/types/domain.ts` and match. CRUD payloads
  are not the problem.