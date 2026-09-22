# AGENTS.md (root)

## Project
LunaLearn — demo-ready MVP. Core loop: understand academic situation →
identify risk/weak areas → recommend what to study → help the student learn
→ update progress. See `plan.md` for the full layered build order.

## Stack
- Next.js + TypeScript + Tailwind CSS
- Supabase: Postgres, Auth, Storage, pgvector
- RAG: chunking → embeddings → pgvector semantic search

## Design system
Background #F8F7FF · Cards #FFFFFF · Primary #6C4CE8 · Deep Primary #4B2DB8 ·
Accent #A78BFA · Highlight #D8CCFF · Text #1F1733 · Muted #6F6680
Modern, clean, premium, light lavender/white, purple primary, rounded cards,
subtle shadows, soft gradients, minimal glassmorphism.

## Repo layout
/app (routes), /components, /lib (db, ai, planner, rag), /supabase
(migrations), /team/person-1-frontend, /person-2-backend, /person-3-ai-rag —
each with its own prompt.md, permission.md, AGENTS.md.

## Definition of done (demo)
Log in → add subject/topics/exam/tasks → see dashboard with readiness % and
a reasoned risk alert → upload a PDF → ask AI about it → generate a quiz →
get a score + weak-topic feedback → see the planner mission update.

## Demo data
Subject: DBMS, exam in 6 days. Topics: SQL (strong), ER Model (strong),
Normalization (weak), Transactions (weak), Indexing (partial). Keep this
seedable — everyone should be able to reset to it.

## Working agreement
- Build in the layer order in `plan.md`, not the original hour order.
- Never sacrifice a core-loop layer (0–7) to build a nice-to-have (quiz
  polish, analytics, knowledge graph, notifications, what-if simulator).
- Flag a change to a shared contract (API shape, table column, prop) before
  merging — don't let another track discover it via a broken build.
- Read root `permission.md` and your own team folder's `permission.md`
  before touching anything outside your layer.