# LunaLearn: Complete UI/UX Design Context & Enhancement Blueprint

> **File:** `design-context.md`  
> **Target Audience:** Frontend Engineers, UI/UX Designers, and AI Frontend Design Tools (Google Stitch, Figma, v0, Lovable).  
> **Application:** **LunaLearn** — An AI-powered, calm, and cozy academic co-pilot for university students.

---

## 1. Executive Summary & Design Philosophy

### 1.1 Product Vision & Core Persona
LunaLearn transforms overwhelming university syllabi, lecture slides, assignments, and exam deadlines into a **calm, focused, and beautifully structured academic roadmap**.
- **Target Persona:** Engineering and STEM university students managing 5–7 complex courses simultaneously. They suffer from exam anxiety, fragmented study materials, and cognitive overload.
- **Aesthetic Core:** **"Midnight Lunar Library"** — A serene, dreamy atmosphere reminiscent of late-night library study sessions under gentle moonlight, warm embers, and celestial violet tones.

### 1.2 The Three Design Pillars
1. **Calm Academic Guidance over Dashboard Clutter:**  
   Every screen answers: *"What should I focus on right now?"* rather than bombarding the user with noisy charts and arbitrary data.
2. **Cozy Depth over High-Contrast Harshness:**  
   Soft layered velvets, subtle glass halos, smooth rounded corners (`2rem` / `rounded-3xl`), and gentle ambient breathing motion replace harsh black-and-white grids.
3. **Deterministic Truth & Resilient AI Integration:**  
   Readiness scores, risks, and study hours are strictly calculated from real user progress. When AI services are offline or slow, the UI provides explicit, reassuring fallback states rather than breaking or hanging.

---

## 2. Design Tokens & Design System Specification

### 2.1 Color Tokens & Theming (`tailwind.config.ts` & `globals.css`)

```
========================================================================================
TOKEN               LIGHT MODE (Daylight Lavender)   DARK MODE (Midnight Lunar Library)
========================================================================================
--canvas            #F8F7FF (Crisp pale lavender)    #0E0C1B (Deep velvet twilight)
--surface           #FFFFFF (Pure white shell)       #151229 (Elevated container)
--card              #FFFFFF (Pure white card)        #1A1633 (Velvet card surface)
--card-glass        rgba(255, 255, 255, 0.88)        rgba(26, 22, 51, 0.76)
--primary           #6C4CE8 (Royal Indigo)           #8E72FF (Glowing Iris)
--deep              #4B2DB8 (Deep Twilight Purple)   #6D4BD9 (Royal Amethyst)
--accent            #A78BFA (Pastel Wisteria)        #C4B5FD (Moonlight Lavender)
--highlight         #D8CCFF (Light Lavender)         rgba(167, 139, 250, 0.22)
--ink               #1F1733 (Deep Obsidian Ink)      #F1EEFA (Starlight White)
--muted             #6F6680 (Slate Purple)           #A29BB8 (Nebula Gray)
--border-subtle     #E7E2FA (Hairline Divider)       rgba(167, 139, 250, 0.15)
--shadow-soft       0 12px 32px rgba(75,45,184,.08)  0 14px 36px rgba(0,0,0,0.45)
--shadow-float      0 18px 45px rgba(75,45,184,.15)  0 20px 50px rgba(0,0,0,0.65)
--nebula-top        rgba(108, 76, 232, 0.08)         rgba(142, 114, 255, 0.18)
--nebula-bottom     rgba(245, 158, 11, 0.06)         rgba(251, 191, 36, 0.09) (Hearth Amber)
========================================================================================
```

### 2.2 Semantic Status Colors
- **Success / Mastered:** Emerald Teal (`#10B981` / Dark: `#34D399`)
- **Warning / Review Needed:** Cozy Amber Embers (`#F59E0B` / Dark: `#FBBF24`)
- **Danger / Urgent Deadline Risk:** Rose Coral (`#EF4444` / Dark: `#F87171`)
- **Info / RAG Grounded:** Celestial Cyan (`#06B6D4` / Dark: `#38BDF8`)

### 2.3 Typography Scale
- **Headings Font:** Inter or system sans-serif (`font-family: Inter, system-ui, sans-serif`)
- **Hierarchy:**
  - `Display / Hero Title`: `text-3xl md:text-5xl font-black tracking-tight leading-tight`
  - `Page Header (H1)`: `text-2xl md:text-3xl font-black tracking-tight text-ink`
  - `Card Header (H2)`: `text-lg md:text-xl font-bold text-ink`
  - `Section / Modal Title (H3)`: `text-base md:text-lg font-bold text-ink`
  - `Overlines / Badges`: `text-xs font-bold uppercase tracking-[.16em] text-accent`
  - `Body Standard`: `text-sm leading-6 text-ink`
  - `Captions & Metadata`: `text-xs text-muted`

### 2.4 Corner Radii & Elevation
- **Modals & Hero Banners:** `rounded-3xl` (`24px`) or `rounded-[2rem]` (`32px`)
- **Cards & Data Tables:** `rounded-2xl` (`16px`)
- **Buttons, Text Inputs & Dropdowns:** `rounded-xl` (`12px`)
- **Badges, Tags, User Avatars & Sliders:** `rounded-full` (`9999px`)

### 2.5 Atmospheric Animations & Motion Tokens
1. **Nebula Drift (`@keyframes nebulaDrift` — 18s ease-in-out infinite alternate):**  
   Ambient glowing cosmic background orbs float smoothly across the top-right and bottom-left, giving the viewport depth and breath.
2. **Velvet Theme Transition (`450ms cubic-bezier(0.4, 0, 0.2, 1)`):**  
   Class `.theme-transitioning` added during mode toggle to guarantee zero harsh flashes when changing light/dark mode.
3. **Lunar Card Glow (`.lunar-card`):**  
   On hover: `transform: translateY(-2px); box-shadow: 0 16px 40px -10px rgba(0,0,0,0.6), 0 0 25px rgba(142,114,255,0.16); border-color: rgba(196,181,253,0.35);`.
4. **Pulse Ring (`@keyframes pulseRing` — 2.8s ease-in-out infinite):**  
   Gently pulses readiness indicator rings without demanding aggressive attention.
5. **Glare Hover (`.glare-hover`):**  
   Subtle reflective light sheen that glides across primary cards on hover.

---

## 3. Application Architecture & Screen Inventory

### 3.1 Global Navigation Shell (`AppShell.tsx`)
- **Left Desktop Sidebar (Fixed 260px):**
  - **Brand Header:** Glowing LunaLearn star logo + product version tag.
  - **Nav Group — Core:** Dashboard, Syllabus Learning, Materials Library, Exam Readiness, Tasks.
  - **Nav Group — AI Suite:** AI Assistant, Dynamic Quizzes, Smart Planner.
  - **Nav Group — Insights:** Performance Analytics, Grade Simulator, Notifications, Settings.
  - **User Profile Pill (Bottom):** User avatar, full name, enrolled degree & semester, log out trigger.
- **Top Header Bar (Sticky):**
  - **Breadcrumbs:** Current section title and active view path.
  - **Status Indicators:** Database connectivity status badge, offline resilience indicator.
  - **Header Actions:** Quick Theme Toggle (Sun ⟷ Moon morphing button), Notifications Bell with unread badge counter.
- **Mobile Navigation:**
  - Responsive hamburger drawer slide-in with frosted backdrop blur (`backdrop-blur-md`).

---

## 4. Screen-by-Screen UI/UX Deep Dive & Redesign Blueprints

### Screen 1: Auth & Onboarding (`/login`)
- **Current State:**
  - Two-column split layout on desktop (`lg:grid-cols-2`).
  - Left Column: Rich gradient hero showcase with value-proposition bullets.
  - Right Column: Glassmorphism auth card containing tabbed Sign In / Sign Up, one-click demo login button, and 3-step syllabus onboarding flow.
- **Identified UX Friction Points:**
  - Card container previously had hardcoded white backgrounds (`bg-white/90`), which can cause contrast mismatches in dark mode.
  - Onboarding syllabus upload step lacks a drag-and-drop visual dropzone state with animated file parsing progress.
- **Enhancement Blueprint for Stitch/Figma:**
  - Convert auth card to `bg-card border border-highlight/30 text-ink shadow-float`.
  - Add interactive SVG dropzone with upload preview (file size, page count, PDF icon).
  - Add a live interactive preview of the student's semester calendar during signup.

### Screen 2: Academic Dashboard (`/dashboard`)
- **Current State:**
  - **Hero Banner:** "Good morning / evening" personalized banner with current study mission and "Start Study Session" primary button.
  - **Quick Metric Tiles:** Active Courses, Overdue Tasks, Next Exam countdown, Overall Academic Readiness score.
  - **Exam Readiness Widget:** Circular progress score (`pulse-ring`), days remaining, subject title.
  - **Today's Missions:** 3 prioritized study action items with direct "Study Now" links.
  - **Academic Risk Callout:** Workload conflict warnings or "Deadlines on track" reassurance.
- **Identified UX Friction Points:**
  - Dashboard can feel text-dense when a student has 6+ subjects.
  - Metric tiles lack sparklines or micro-charts showing 7-day readiness velocity.
- **Enhancement Blueprint for Stitch/Figma:**
  - Introduce mini radial sparklines inside metric tiles.
  - Add quick-filter chips for Today's Missions: `[All | Urgent | Quizzes | Readings]`.
  - Provide an interactive "Focus Mode" modal that isolates a single task with an integrated 25-minute Pomodoro timer.

### Screen 3: Syllabus & Topic Navigator (`/learning`)
- **Current State:**
  - Horizontal subject tab bar with active indicator pill.
  - Units listed sequentially with topic count and mastery progress percentage.
  - Topics displayed with 3-tier status badges (`not_started`, `in_progress`, `mastered`), weakness flags (`is_weak`), and mastery sliders.
  - Floating action buttons to add Unit or add Topic.
- **Identified UX Friction Points:**
  - Horizontal scrolling tab bar on mobile can hide subjects offscreen without clear overflow arrows.
  - Topic status toggles are plain dropdowns rather than engaging interactive pills.
- **Enhancement Blueprint for Stitch/Figma:**
  - Implement a visual **Course Roadmap Tree** or interactive node graph showing topic dependencies and exam weightage.
  - Include quick action buttons on each topic card: `[Generate Quiz]`, `[Ask AI]`, `[Mark Mastered]`.

### Screen 4: Materials & Document Library (`/materials`)
- **Current State:**
  - PDF document grid/table with file size, uploaded date, subject badge, and delete button.
  - Full-text and metadata search bar.
  - PDF Upload modal with RAG indexing status indicator.
- **Identified UX Friction Points:**
  - Document cards lack page count, chunk indexing count, and preview thumbnails.
  - No visual distinction between "Indexed & Ready for AI" vs "Processing Chunks".
- **Enhancement Blueprint for Stitch/Figma:**
  - Add visual thumbnail previews for uploaded PDF documents.
  - Add a pulsing "Vector Indexing" progress bar showing chunk extraction progress (`0% -> 100%`).
  - Add a "Test Retrieval" search tab allowing students to query their notes and see matching text chunks with relevance scores.

### Screen 5: Exam Readiness & Risk Center (`/exams`)
- **Current State:**
  - Exam cards listing course code, exam date, countdown days, and calculable readiness percentage.
  - Risk banners flagging workload spikes and low-mastery warnings.
  - Schedule Exam modal with date and subject pickers.
- **Identified UX Friction Points:**
  - When an exam has 0 topics completed, readiness displays `0%` without guiding the student on the fastest path to 50%.
- **Enhancement Blueprint for Stitch/Figma:**
  - Add a **"High-Yield Roadmap"** panel for each exam that highlights the top 3 unmastered topics carrying the highest exam weightage.
  - Include an interactive countdown clock with visual urgency styling (Amber at < 7 days, Coral at < 48 hours).

### Screen 6: Task & Deadline Hub (`/tasks`)
- **Current State:**
  - Grouped task list with completion checkboxes, priority badges (High/Medium/Low), course associations, and due dates.
  - Summary progress card showing total tasks remaining and completion percentage.
  - Add Task modal.
- **Identified UX Friction Points:**
  - Tasks are purely linear; no Kanban board or Calendar timeline view.
- **Enhancement Blueprint for Stitch/Figma:**
  - Add a View Switcher: `[List View | Calendar Timeline | Kanban Columns (To Do, In Progress, Done)]`.
  - Include a "Smart Schedule" button that auto-orders tasks by exam proximity and priority.

### Screen 7: RAG AI Study Assistant (`/assistant`)
- **Current State:**
  - Multi-turn conversational chat interface.
  - Subject and Material dropdown filters to narrow the RAG search scope.
  - Message bubbles showing student questions and AI responses with source chunk citations.
  - Clear error states for rate limits or missing context.
- **Identified UX Friction Points:**
  - Chat input is single-line; needs support for multiline questions and prompt suggestion pills (`"Explain Unit 2 concepts"`, `"Give me 3 practice problems"`).
  - Source chunk citations are plain text; they should open an expandable citation drawer with exact page references.
- **Enhancement Blueprint for Stitch/Figma:**
  - Add floating prompt suggestion chips above the chat input.
  - Introduce an interactive Split Screen: AI Assistant on the left, PDF Document Viewer with highlighted citation text on the right.

### Screen 8: Dynamic Quizzes & Knowledge Checks (`/quizzes`)
- **Current State:**
  - Subject and topic selector to trigger AI quiz generation.
  - Interactive multiple-choice question cards with instant feedback on submission.
  - Score summary card displaying weak topics identified and detailed rationales.
  - Resilient offline fallback banner when running without live Gemini API.
- **Identified UX Friction Points:**
  - Quizzes display all questions at once on a long scroll, which can feel overwhelming.
- **Enhancement Blueprint for Stitch/Figma:**
  - Implement a **One-Question-at-a-Time "Focus Card" Mode** with smooth slide transitions and a progress bar.
  - Include an immediate celebratory confetti / starlight firefly animation when a student scores >= 80%.

### Screen 9: Smart Study Planner (`/planner`)
- **Current State:**
  - Displays daily study blocks aligned with upcoming exams and weak topics.
- **Enhancement Blueprint for Stitch/Figma:**
  - Day / Week interactive time-blocking grid.
  - Drag-and-drop study session reorganization.
  - Sync with Google Calendar / iCal export button.

### Screen 10: Performance Analytics (`/analytics`)
- **Current State:**
  - Metrics on study time, topic mastery, and subject breakdown.
- **Enhancement Blueprint for Stitch/Figma:**
  - Visual charts: Topic Mastery Radar Chart, Weekly Study Hour Heatmap, Exam Readiness Trendlines.
  - Streak tracker with cosmic badges ("Night Owl Scholar", "7-Day Consistent Streak").

### Screen 11: Settings & Preferences (`/settings`)
- **Current State:**
  - Theme Selector: Dreamy Dark (Midnight Lunar Library), Daylight (Daylight Lavender), System Sync.
  - API connectivity indicators and student profile settings.
- **Enhancement Blueprint for Stitch/Figma:**
  - Interactive Theme Preview Cards showing live miniaturized UI previews before selection.
  - Notification toggle switches (Daily study reminder, Exam countdown warnings).

---

## 5. Reusable Component Catalog

| Component Name | File Location | Key Props / Variants | Primary Role |
| :--- | :--- | :--- | :--- |
| `<Card>` | `components/Ui.tsx` | `children, className` | Base elevated container with subtle border and dark mode support |
| `<PageHeader>` | `components/Ui.tsx` | `title, subtitle, action` | Standardized top heading with action slot |
| `<Progress>` | `components/Ui.tsx` | `value, max, color` | Animated progress bar with smooth CSS fill transition |
| `<Risk>` | `components/Ui.tsx` | `label, detail` | Warning / reassurance banner with amber/rose accent borders |
| `<TaskRow>` | `components/Ui.tsx` | `title, meta, done, onToggle` | Checkbox item with strikethrough completion animation |
| `<Mission>` | `components/Ui.tsx` | `title, sub, time` | Highlighted daily action card with quick-launch button |
| `<ThemeToggle>` | `components/ThemeToggle.tsx`| *none* | Sun ⟷ Moon morphing button with spring rotation and glow |
| `<AppShell>` | `components/AppShell.tsx` | `children` | Responsive 2-column layout with sidebar and ambient nebula orbs |

---

## 6. Micro-Interactions & Animation Guidelines

```
+---------------------------------------------------------------------------------------+
| INTERACTION TYPE       TRIGGER             ANIMATION SPECIFICATION                     |
+---------------------------------------------------------------------------------------+
| Ambient Atmosphere     Continuous          18s ease-in-out nebulaDrift (.cosmic-orb)   |
| Theme Switch           Click toggle        450ms cubic-bezier(0.4, 0, 0.2, 1) velvet   |
| Card Hover             Mouse enter         250ms translateY(-2px), lunar-card glow     |
| Button Press           Active / Click      150ms scale(0.97) + clickSpark radial burst |
| Page / Tab Transition  Route change        550ms pageFade + floatIn (.2, .8, .2, 1)    |
| Progress Bar Fill      Value change        850ms progressReveal (scaleX(0) to 1)       |
| Exam Readiness Ring    Continuous          2.8s pulseRing (scale(1.07), opacity .55)   |
+---------------------------------------------------------------------------------------+
```

---

## 7. Stitch MCP Prompting Cheat Sheet

Use these structured prompts directly in your AI frontend design tool or Stitch MCP (`generate_screen_from_text`):

### Prompt 1: Redesign Academic Dashboard
> *"Generate a modern, dreamy academic dashboard screen for LunaLearn in dark mode. The theme is 'Midnight Lunar Library' using deep velvet twilight (#0E0C1B) background, card surfaces (#1A1633), and glowing iris (#8E72FF) accents. Include a top greeting hero card with an 18-minute study timer, 4 quick stat cards (Active Courses, Readiness Score 82% with circular ring, 3 Overdue Tasks, Next Exam in 5 days), Today's Study Missions with 3 action cards, and an Academic Risks alert box. Use rounded-3xl cards, subtle violet borders, and modern sans-serif typography."*

### Prompt 2: One-Question-at-a-Time Quiz Focus Screen
> *"Generate an interactive quiz focus screen for university students in dark mode. Include a top progress bar ('Question 3 of 5'), a central elevated card with question text: 'Which SQL normal form eliminates transitive dependencies?', four multiple-choice option cards with soft lavender hover borders, a bottom bar with 'Previous', 'Skip', and 'Submit Answer' buttons, and an estimated time remaining badge ('2m 30s')."*

### Prompt 3: Split-View AI Study Assistant & Note Reader
> *"Generate a split-screen study workspace for LunaLearn. On the left side (45% width): an AI chat assistant with prompt suggestion chips ('Explain 3NF with examples', 'Generate a summary quiz'), user message bubbles in royal amethyst (#6D4BD9), and AI answers with clickable citation badges. On the right side (55% width): a PDF document viewer showing lecture slides with highlighted yellow text corresponding to the AI's citation."*

---

## 8. Accessibility & Quality Checklist

- [x] **WCAG AA Contrast Compliant:** All text (`--ink`) meets >= 4.5:1 contrast ratio against `--card` and `--canvas`.
- [x] **Zero White Flash Anti-FOUC:** Synchronous `<script>` in `<head>` applies `.dark` before first DOM paint.
- [x] **Reduced Motion Support:** `@media (prefers-reduced-motion: reduce)` disables heavy keyframe animations.
- [x] **Keyboard Navigable:** Visible focus rings (`outline-primary`) on all interactive inputs, buttons, and tabs.
- [x] **Deterministic Data States:** Loading skeletons (`.shimmer`), empty states, and offline resilience banners for every data card.
