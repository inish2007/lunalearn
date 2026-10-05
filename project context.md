# LunaLearn — Project Context & Architecture Guide

> **LunaLearn** is an AI-powered personal academic navigator built for university students. Rather than functioning as a passive task manager, LunaLearn dynamically synthesizes syllabus progress, upcoming exam dates, course materials, quiz performance, and study habits into prioritized daily missions, readiness scores, and calm, actionable study roadmaps.

---

## 1. Executive Summary & Product Vision

- **Product Name**: LunaLearn
- **Core Tagline**: *"Don’t just manage. Navigate. Make every study hour count."*
- **Target Audience**: College / university students (exemplified in the canonical demo profile by *Aarav Patel, B.Tech · Semester 4*).
- **Primary Problem Solved**: Academic anxiety, cognitive overload, and inefficient cramming caused by fragmented notes, unclear syllabus completion, and uncertainty about what to study next.
- **Core Value Propositions**:
  1. **Daily Missions**: Directs the student to the highest-leverage task for the day (e.g., stabilizing DBMS readiness before a mid-term).
  2. **Multi-Factor Exam Readiness**: Computes an algorithmic readiness score based on topics covered, quiz results, assignment completion, and revision consistency.
  3. **Grounded AI Study Assistant**: AI tutor grounded in uploaded course PDFs, slides, and lecture notes using semantic vector retrieval.
  4. **Diagnostic Practice Quizzes**: Automatically generates multiple-choice quizzes from course materials and identifies weak topics to update the study plan.
  5. **What-If Simulator**: Predicts the impact of allocating study hours across different subjects before committing.
  6. **Calm Aesthetic Experience**: Designed under the "Midnight Lunar Library" (dark) and "Daylight Lavender" (light) themes with soothing ambient motion.

---

## 2. Directory & Repository Structure

```
LunaLearn/
├── .agents/                              # Workflows and agent customizations
├── .git/                                 # Git tracking repository
├── .gitignore                            # Root ignore file
├── BUGS.md                               # Tracking and resolutions for handoffs & bugs
├── CONTRACTS.md                          # Comprehensive API request/response contracts
├── DESIGN.md                             # UI/UX design tokens, themes & animations spec
├── design-context.md                     # Complete design blueprint for frontend tooling
├── context.md                            # Full-stack integration & system status
├── project_context.md                    # Core project context & architecture guide
├── backend/                              # Node.js + TypeScript academic backend
│   ├── src/
│   │   ├── index.ts                      # Server entry point & CORS configuration (:4000)
│   │   ├── lib/
│   │   │   ├── local-store.ts            # LocalDevStore (in-memory + scratch/local-db.json)
│   │   │   ├── scoped-client.ts          # Authenticated scoped client resolver
│   │   │   └── supabase.ts               # Supabase client initializer & fallback detector
│   │   ├── routes/
│   │   │   ├── assistant.routes.ts       # AI Assistant chat & query endpoints
│   │   │   ├── auth.routes.ts            # Signup, login, and me endpoints
│   │   │   ├── domain.routes.ts          # Subjects, units, topics, tasks, exams, materials
│   │   │   ├── engine.routes.ts          # Readiness, risks, and health endpoints
│   │   │   ├── planner.routes.ts         # Unified planner context endpoint
│   │   │   ├── quiz.routes.ts            # Quiz generation and submission endpoints
│   │   │   └── rag.routes.ts             # PDF upload, chunking, and semantic search
│   │   ├── services/                     # Business logic and external API integrations
│   │   │   ├── assistant.service.ts      # Grounded chat with citations
│   │   │   ├── auth.service.ts           # Authentication & token generation
│   │   │   ├── embedding.service.ts      # Google Gemini vector embeddings
│   │   │   ├── engine.service.ts         # Algorithmic readiness & risk scoring
│   │   │   ├── planner-context.service.ts# Adaptive daily timeline synthesizer
│   │   │   ├── quiz.service.ts           # Grounded quiz generation & evaluation
│   │   │   ├── rag-material.service.ts   # Multipart PDF upload, parsing & chunking
│   │   │   └── semantic-search.service.ts# Cosine similarity vector search
│   │   ├── types/
│   │   │   └── domain.ts                 # Zod validation schemas & TypeScript interfaces
│   │   └── scripts/                      # Seeders & automated verification test suites
│   ├── scratch/
│   │   └── local-db.json                 # Persistent local JSON store for offline dev
│   └── package.json                      # Backend dependencies & npm scripts
└── frontend/                             # Next.js 14 App Router application
    ├── app/                              # Next.js App Router routes (18 static routes)
    │   ├── analytics/page.tsx            # Analytics & study habits view
    │   ├── assistant/page.tsx            # Grounded AI study assistant
    │   ├── dashboard/page.tsx            # Main student dashboard
    │   ├── exams/page.tsx                # Exam readiness & factor breakdowns
    │   ├── learning/page.tsx             # Syllabus tracking & unit breakdown
    │   ├── login/page.tsx                # Onboarding & authentication flow
    │   ├── materials/page.tsx            # Personal library (PDFs, notes, slides)
    │   ├── notifications/page.tsx        # System & deadline notifications
    │   ├── planner/page.tsx              # Adaptive daily timeline & availability
    │   ├── profile/page.tsx              # Long-term learning profile & strengths
    │   ├── quizzes/page.tsx              # Diagnostic practice quizzes & scoring
    │   ├── settings/page.tsx             # Student settings & preferences
    │   ├── simulator/page.tsx            # What-If study hours simulator
    │   ├── tasks/page.tsx                # Tasks, assignments & deadline conflicts
    │   ├── globals.css                   # Custom theme tokens, keyframes & utilities
    │   ├── layout.tsx                    # Root layout with ThemeProvider & AcademicProvider
    │   └── page.tsx                      # Root redirect (redirects to /dashboard)
    ├── components/                       # Shared UI & layout components
    │   ├── AppShell.tsx                  # Global navigation sidebar, header & theme toggle
    │   ├── Dashboard.tsx                 # Dashboard home composition & widgets
    │   ├── ThemeToggle.tsx               # Celestial Sun/Moon theme switcher
    │   ├── Ui.tsx                        # Reusable primitives (Card, Progress, Risk, Mission)
    │   └── Workspace.tsx                 # Feature view switchboard & client implementations
    ├── lib/
    │   ├── api.ts                        # Unified REST API client for backend
    │   ├── context/
    │   │   ├── AcademicContext.tsx       # Global academic state, active subject, refetches
    │   │   └── ThemeContext.tsx          # Dark/light theme state & local persistence
    │   └── types/
    │       └── academic.ts               # Domain interfaces & API response payloads
    ├── tailwind.config.ts                # Tailwind theme customization & color tokens
    └── package.json                      # Frontend dependencies & npm scripts
```

---

## 3. Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend Framework** | Next.js (App Router) | `14.2.5` | React server/client architecture, routing, optimized bundling |
| **Frontend UI Library** | React / React DOM | `18.3.1` | Declarative component UI |
| **Styling & Theming** | Tailwind CSS & Vanilla CSS | `3.4.7` | Utility styling with CSS variable design tokens and animations |
| **Icons** | Lucide React | `^0.468.0` | Minimalist icons for academic navigation |
| **Backend Framework** | Node.js / Express | `20.x` / Node | HTTP REST API server running on port 4000 |
| **Language** | TypeScript | `5.5.4` | Strict end-to-end type safety |
| **Data Validation** | Zod | `3.23.8` | Strict runtime schema validation for all API inputs |
| **Database & Auth** | Supabase (PostgreSQL + RLS) | `2.45.4` | Production cloud database and authentication |
| **Local Dev Store** | LocalDevStore (`local-store.ts`) | Custom | In-memory & JSON file-backed fallback with RLS simulation |
| **AI / LLM Engine** | Google Gemini (`@google/genai`) | Gemini 1.5 | Grounded chat, quiz generation, and 1536-dim vector embeddings |
| **Document Processing** | `pdf-parse` & `busboy` | `2.4.5` / `1.6.0` | Multipart streaming and binary PDF text extraction |

---

## 4. Design System & Theme Tokens

LunaLearn features two harmonious theme modes defined in `DESIGN.md`:

### A. Dark Mode: *Midnight Lunar Library* (Default)
- **`--canvas`** (`#0E0C1B`): Deep velvet twilight canvas background.
- **`--surface`** (`#151229`): Elevated container & modal background.
- **`--card`** (`#1A1633`): Velvet card background with subtle purple tint.
- **`--primary`** (`#8E72FF`): Glowing iris for primary actions and focus rings.
- **`--deep`** (`#6D4BD9`): Royal amethyst for active nav indicators and headings.
- **`--accent`** (`#C4B5FD`): Moonlight lavender for badges and links.
- **`--ink`** (`#F1EEFA`): Starlight white for primary text.
- **`--muted`** (`#A29BB8`): Nebula gray for metadata and captions.

### B. Light Mode: *Daylight Lavender*
- **`--canvas`** (`#F8F7FF`): Crisp pale lavender-tinted white background.
- **`--surface`** (`#FFFFFF`): Pure white shell.
- **`--card`** (`#FFFFFF`): Crisp white cards.
- **`--primary`** (`#6C4CE8`): Royal indigo for buttons and active states.
- **`--deep`** (`#4B2DB8`): Deep twilight purple for brand headings.
- **`--accent`** (`#A78BFA`): Pastel wisteria for tags and progress bars.
- **`--ink`** (`#1F1733`): Deep obsidian purple for text.
- **`--muted`** (`#6F6680`): Slate purple for captions.

---

## 5. Domain Models & Core Types (`frontend/lib/types/academic.ts`)

```typescript
export type RiskLevel = 'High' | 'Medium' | 'On track';

export interface Subject {
  id: string;
  name: string;
  code: string;
  progress: number;        // Syllabus completion percentage
  readiness: number;       // Exam readiness percentage
  color: string;           // Brand hex color for course badge
  topics: number;          // Total topics in syllabus
  completedTopics: number; // Topics completed
  weakTopics: string[];    // Identified weak areas needing revision
}

export interface Task {
  id: string;
  title: string;
  subject: string;
  due: string;
  type: 'Assignment' | 'Task' | 'Revision';
  priority: 'High' | 'Medium' | 'Low';
  done?: boolean;
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  date: string;
  daysAway: number;
  readiness: number;
  weakTopics: string[];
  reason: string;
}

export interface Material {
  id: string;
  name: string;
  subject: string;
  folder: string;
  type: 'PDF' | 'Notes' | 'Slides';
  size: string;
  updated: string;
}

export interface AssistantSourceChunk {
  document_name: string;
  similarity: number;
  chunk_text: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  explanation?: string;
}
```

---

## 6. Current Implementation Status

- **Frontend & Navigation:** Complete. 18 static routes prerendering successfully with responsive drawer sidebar, top navigation, and theme toggle.
- **Backend API & Routing:** Complete. All endpoints defined in `CONTRACTS.md` implemented and tested with 97/97 domain assertions passing.
- **Offline / Local Simulation:** Complete. `LocalDevStore` provides complete zero-configuration local execution with real data persistence in `backend/scratch/local-db.json`.
- **AI & RAG Engine:** Complete. PDF text extraction, Gemini embeddings, vector cosine retrieval, grounded assistant with citations, and diagnostic quizzes are live and verified with 50/50 test assertions passing.
- **Adaptive Study Planner:** Complete. Dynamic feedback loop connects quiz scores, syllabus completion, and assignment deadlines into daily study missions.

---

## 7. How to Run Locally

### Start Backend (`http://localhost:4000`):
```bash
cd backend
npm install
npm run seed     # Seeds demo user (aarav.patel@example.com / password123) and DBMS course
npm run dev      # Boots backend dev server
```

### Start Frontend (`http://localhost:3000`):
```bash
cd frontend
npm install
npm run dev      # Boots Next.js development server
```
