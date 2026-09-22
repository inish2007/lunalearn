# LunaLearn — Project Context & Architecture Guide

> **LunaLearn** is an AI-powered personal academic navigator built for university students. Rather than functioning as a passive task manager, LunaLearn dynamically synthesizes syllabus progress, upcoming exam dates, course materials, quiz performance, and study habits into prioritized daily missions, readiness scores, and calm, actionable study roadmaps.

---

## 1. Executive Summary & Product Vision

- **Product Name**: LunaLearn
- **Core Tagline**: *"Don’t just manage. Navigate. Make every study hour count."*
- **Target Audience**: College / university students (exemplified in the current mock profile by *Aarav Verma, B.Tech · Semester 4*).
- **Primary Problem Solved**: Academic anxiety, cognitive overload, and inefficient cramming caused by fragmented notes, unclear syllabus completion, and uncertainty about what to study next.
- **Core Value Proposition**:
  1. **Daily Missions**: Directs the student to the highest-leverage task for the day (e.g., stabilizing DBMS readiness before a mid-term).
  2. **Multi-Factor Exam Readiness**: Computes a readiness score based on topics covered, quiz results, assignment completion, and revision consistency.
  3. **Grounded AI Study Assistant**: AI tutor grounded in uploaded PDFs, slides, and lecture notes.
  4. **What-If Simulator**: Predicts the impact of allocating study hours across different subjects before committing.
  5. **Unified Academic Hub**: Centralizes syllabus tracking, lecture materials, task deadlines, and revision analytics.

---

## 2. Directory & Repository Structure

```
LunaLearn/
├── .git/                                 # Git tracking repository
├── .gitignore                            # Root ignore file
├── project_context.md                    # Project context & architecture documentation
└── frontend/                             # Next.js 14 App Router application
    ├── app/                              # Next.js App Router routes
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
    │   ├── quizzes/page.tsx              # Diagnostic quizzes & practice checks
    │   ├── settings/page.tsx             # Student settings & preferences
    │   ├── simulator/page.tsx            # What-If study hours simulator
    │   ├── tasks/page.tsx                # Tasks, assignments & deadline conflicts
    │   ├── globals.css                   # Custom theme styles, keyframes & utilities
    │   ├── layout.tsx                    # Root HTML/Body layout with metadata
    │   └── page.tsx                      # Root redirect (redirects to /dashboard)
    ├── components/                       # Shared UI & layout components
    │   ├── AppShell.tsx                  # Global persistent navigation sidebar & header
    │   ├── Dashboard.tsx                 # Dashboard home composition & widgets
    │   ├── Ui.tsx                        # Reusable primitives (Card, Progress, Risk, Mission)
    │   └── Workspace.tsx                 # Route switchboard & feature view implementations
    ├── lib/                              # Shared types, data models & mocks
    │   ├── mocks/
    │   │   └── academic.ts               # Sample mock subjects, tasks, exams, materials
    │   └── types/
    │       └── academic.ts               # TypeScript domain interfaces
    ├── node_modules/                     # Installed npm packages
    ├── next.config.mjs                   # Next.js build configuration
    ├── next-env.d.ts                     # Next.js TypeScript declarations
    ├── package.json                      # Project dependencies & npm scripts
    ├── package-lock.json                 # Locked dependency tree
    ├── postcss.config.mjs                # PostCSS configuration for Tailwind
    ├── tailwind.config.ts                # Tailwind theme customization & color tokens
    └── tsconfig.json                     # TypeScript compiler configuration
```

---

## 3. Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Framework** | Next.js (App Router) | `14.2.5` | React server/client architecture, routing, optimized bundling |
| **UI Library** | React / React DOM | `18.3.1` | Declarative component UI |
| **Language** | TypeScript | `5.5.4` | Strict type safety across academic domain models |
| **Styling** | Tailwind CSS | `3.4.7` | Utility-first styling with custom palette and animations |
| **CSS Preprocessor**| PostCSS & Autoprefixer | `8.4.39` / `10.4.19` | Cross-browser CSS processing |
| **Icons** | Lucide React | `^0.468.0` | Minimalist icons for academic navigation |
| **Fonts** | System Sans-Serif | Native | Fast rendering, clean readability |

---

## 4. Design System & Theme Tokens

LunaLearn uses a lavender/deep purple palette (`#F8F7FF` canvas with rich purple/violet accents) to induce calm focus:

### Color Tokens (`tailwind.config.ts` & `globals.css`)
- **`canvas`** (`#F8F7FF`): Soft lilac-tinted off-white background.
- **`card`** (`#FFFFFF`): Clean white surface for elevated cards.
- **`primary`** (`#6C4CE8`): Radiant royal purple for primary buttons, active tabs, and key progress indicators.
- **`deep`** (`#4B2DB8`): Darker indigo for high-contrast headers, avatar badges, and dark gradient cards.
- **`accent`** (`#A78BFA`): Soft lavender for secondary highlights and badge backgrounds.
- **`highlight`** (`#D8CCFF`): Light pastel violet for borders, track bars, and subtle fills.
- **`ink`** (`#1F1733`): Deep obsidian purple for primary text.
- **`muted`** (`#6F6680`): Slate violet for secondary captions, timestamps, and metadata.

### Shadows & Radii
- **`shadow-soft`**: `0 12px 32px rgba(75,45,184,.08)` — gentle elevation for cards.
- **`shadow-float`**: `0 18px 45px rgba(75,45,184,.15)` — prominent float for hero mission cards.
- **`rounded-4xl`**: `2rem` — playful, friendly curved surfaces.

### Micro-Animations (`globals.css`)
- **`page-fade`**: Smooth entry fade and upward translation on view transitions.
- **`float-in`**: Cubic-bezier spring entry for cards.
- **`pulse-ring`**: Gentle pulsating ring around readiness score circles.
- **`wave-line`**: Animated SVG line stroke for weekly focus time activity.
- **`gradient-orb`**: Blurred luminous backdrop orbs for auth/hero screens.

---

## 5. Domain Models & Data Types (`frontend/lib/types/academic.ts`)

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
```

---

## 6. Application Architecture & Views

### A. Navigation & Shell (`AppShell.tsx`)
- **Collapsible / Drawer Sidebar**:
  - Brand header with animated sparkles icon.
  - Student identity card: *Aarav Verma (B.Tech · Sem 4)* with Level 8 / XP tracker.
  - **Primary Routes**: Dashboard, My Learning, My Materials, AI Assistant, Tasks & Assignments, Study Planner, Exams & Readiness, Quizzes.
  - **Explore Routes**: Analytics, What-If Simulator, Learning Profile, Notifications, Settings.
  - Sign-out link redirecting to `/login`.
- **Top Header**:
  - Real-time formatted date banner.
  - Quick notification bell with active unread pill.
  - User avatar dropdown.

### B. Core Screens Breakdown

1. **Onboarding / Authentication (`/login`)**:
   - 3-step dynamic onboarding carousel (`Welcome`, `A few quick details`, `Ready for clarity?`).
   - Left promotional panel showcasing value proposition and gradient accents.
2. **Dashboard (`/dashboard`)**:
   - **Hero Mission**: Displays the single most important action for today (e.g. *"Stabilize DBMS readiness"*).
   - **Weekly Study Activity**: Interactive SVG curve tracking hours studied (+18% vs prior week).
   - **Priorities & Risk Alert**: Highlights urgent deadlines and topic bottlenecks.
   - **Exam Readiness Widget**: Circular meter indicating readiness with days remaining.
3. **My Learning (`/learning`)**:
   - Course overview cards showing completion vs. readiness.
   - Unit progress accordion (e.g. Unit 1 Fundamentals, Unit 2 ER Modelling, Unit 3 Normalization, Unit 4 Transactions).
4. **My Materials (`/materials`)**:
   - Filterable library of notes, lecture slides, and PDFs.
   - Folder navigation and instant client-side search query.
   - "Try with AI" natural language file command prompt.
5. **AI Assistant (`/assistant`)**:
   - Chat interface pre-loaded with course context (e.g. DBMS).
   - Grounded responses citing specific uploaded documents (e.g., `Normalization Unit 3.pdf`).
   - Quick prompt chips for fast topic explanations and practice questions.
6. **Tasks & Assignments (`/tasks`)**:
   - Filterable task list (`All`, `This week`, `Completed`).
   - Conflict detection alert (overlapping high-priority deadlines).
7. **Study Planner (`/planner`)**:
   - Time-blocked study timeline optimized around student energy peaks (e.g., 5:30 PM - 7:30 PM).
   - "Why this plan?" algorithmic reasoning explanation.
   - 7-day workload distribution chart.
8. **Exams & Readiness (`/exams`)**:
   - Detailed breakdown of readiness score drivers: Topics (62%), Quizzes (55%), Revision (48%), Assignments (80%).
   - Actionable weak topic tags.
9. **Quizzes (`/quizzes`)**:
   - Interactive 5-question multiple choice practice test targeting weak areas.
   - Instant feedback and performance diagnostics.
10. **Analytics (`/analytics`)**:
    - High-level KPIs (Overall Progress, Quiz Average, Focus Time, Study Streak).
    - GitHub-style revision activity calendar matrix.
11. **What-If Simulator (`/simulator`)**:
    - Interactive range slider for available daily study hours.
    - Real-time recalculation of projected readiness improvements and schedule adjustments.
12. **Learning Profile (`/profile`)**:
    - Cognitive profile: Identified strengths (SQL, ER Model) vs. growth areas (Normalization, Deadlocks).
13. **Notifications (`/notifications`)**:
    - Time-stamped alerts for missions, submission reminders, and streak updates.
14. **Settings (`/settings`)**:
    - Profile details, study schedule preferences, and notification toggles.

---

## 7. Current State & Development Roadmap

### Current Implementation Status
- Full frontend UI architecture complete with responsive navigation and design system.
- All 12 primary views implemented via Next.js App Router and dynamic workspace components.
- In-memory mock data layer (`lib/mocks/academic.ts`) providing full student scenarios.

### Recommended Next Steps
1. **Backend & Persistence**:
   - Setup an API layer (Node.js/Next.js API routes or FastAPI/Go backend).
   - Database schema (PostgreSQL/Supabase or Prisma) for Users, Courses, Tasks, Exams, and Materials.
2. **AI & RAG Engine**:
   - Connect the AI Study Assistant to an LLM (e.g., Gemini 1.5 Pro / Flash).
   - Implement document parsing and vector embeddings (pgvector / Pinecone) for PDF and slide retrieval.
3. **Dynamic Planner Algorithm**:
   - Build a scheduling engine that calculates optimal time blocks based on exam proximity and weak topic weightings.
4. **State Management**:
   - Introduce Zustand or TanStack Query for caching and global UI state.

---

## 8. Development & Run Commands

From the `frontend` directory:

```bash
# Install dependencies
npm install

# Run local development server (runs on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linting checks
npm run lint
```
