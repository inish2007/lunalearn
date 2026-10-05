# LunaLearn — Layered Build Plan (Foundation → Top)

Reorganizes the 8-hour plan by dependency layer so all 3 people can work in
parallel without blocking each other.

Legend: P1 = Frontend, P2 = Backend/Academic Engine, P3 = AI/RAG

## Layer 0 — Foundation (Infra & Scaffolding)
Owner: P2 (lead), P1 (assist)
- Next.js + TS + Tailwind project created
- Supabase project connected, env vars set
- Git repo, base layout, nav, route stubs: /dashboard /learning /tasks /exams
  /materials /assistant /planner
Depends on: nothing. Blocks: everything.
Deliverable: app boots, routes resolve, Supabase client connects.

## Layer 1 — Data Schema
Owner: P2
- Tables: profiles, subjects, units, topics, tasks, exams, materials,
  document_chunks, quiz_results, study_sessions
- pgvector enabled on document_chunks
Depends on: L0. Blocks: L2, L3, L5.
Deliverable: schema migrated, tables exist.

## Layer 2 — Authentication
Owner: P2 (logic/API), P1 (login/signup UI)
- Sign up, login, logout, protected dashboard, basic profile
Depends on: L1. Blocks: everything past this point.
Deliverable: user can sign up, log in, reach /dashboard.

## Layer 3 — Core Domain CRUD + Dashboard Shell
Owner: P2 (APIs), P1 (UI)
- P2: CRUD APIs — subjects/units/topics/tasks/exams/materials
- P1: Dashboard, Learning, Tasks, Exams, Materials pages (mock data first,
  swap to live as APIs land)
Depends on: L1, L2. Blocks: L4, L5, L6.
Deliverable: user can add a subject/topic/exam/task and see it listed.

## Layer 4 — Academic Engine (Readiness + Risk)
Owner: P2
- Readiness = TopicCompletion×40% + QuizPerformance×30% +
  RevisionActivity×20% + AssignmentCompletion×10%
- Risk rules: HIGH_EXAM_RISK, DEADLINE_RISK, PERFORMANCE_RISK,
  WORKLOAD_RISK — every risk carries a reason, not just a label
Depends on: L3. Blocks: Dashboard widgets (P1), Planner inputs (P3).
Deliverable: API returns readiness % and reasoned risk alerts per subject.

## Layer 5 — Content Pipeline (PDF → RAG)
Owner: P3
- Upload → Storage → text extraction → chunking → embeddings → pgvector →
  semantic search
Depends on: L1 (tables), L3 (upload UI stub from P1). Blocks: L6.
Deliverable: an uploaded PDF is searchable; a query returns relevant chunks.

## Layer 6 — AI Study Assistant
Owner: P3 (logic/prompting), P1 (chat UI)
- Context per call: student info + subjects + topics + exam dates + tasks +
  quiz results + retrieved chunks
- Capabilities: explain, simplify, summarize, generate examples/questions/
  quizzes, recommend next topic
Depends on: L4, L5. Blocks: L7.
Deliverable: assistant answers questions about an uploaded PDF, grounded in
retrieved context.

## Layer 7 — Adaptive Planner + Quiz
Owner: P3 (generation), P1 (UI), P2 (feeds readiness/task data as inputs)
- Quiz: 5 questions, scored, weak-topic detection
- Planner: time-blocked "today's mission" from exam dates, weak/unfinished
  topics, pending tasks, available time
Depends on: L4, L6. Blocks: L8.
Deliverable: a quiz score changes readiness; planner output changes when
weak topics change.

## Layer 8 — Integration & Polish (Top Layer)
Owner: all three
- Wire the full loop: dashboard → weak topic → assistant → quiz → updated
  readiness → new mission
- Responsive layout, loading/error/empty states, demo seed data, no console
  errors
Depends on: L0–L7.
Deliverable: the Definition of Done flow works live for the DBMS demo.

## Cross-track handoff points (where parallel work stalls)
- P1 can't wire real Dashboard data until P2 ships L3 APIs + L4 endpoint.
- P3 can't start L5 until P2 ships materials/document_chunks (L1) and P1 has
  an upload stub (L3).
- P1's Assistant/Planner/Quiz UI can be built against mocks in parallel with
  P3's L5–L7, then swapped to live calls at L8.