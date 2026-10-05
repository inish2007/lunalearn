# LunaLearn Design System Specification (`DESIGN.md`)

## 1. Brand Identity & Aesthetic Philosophy
LunaLearn is an intelligent, calm, and cozy academic co-pilot built to make studying feel focused, serene, and magical rather than stressful. The visual language blends **modern academic precision** with a **dreamy celestial atmosphere**.

- **Core Metaphor**: Midnight Lunar Library — quiet late-night study sessions illuminated by soft starlight and gentle hearth embers.
- **Visual Tenets**:
  1. **Cozy Depth over Stark Contrast**: Soft layered velvets, subtle glass halos, and gentle gradients rather than pure pitch blacks or harsh borders.
  2. **Breathing Ambient Motion**: Smooth, organic, slow-paced transitions (18s cosmic nebula breathing, 450ms velvet theme transitions) that keep the interface feeling alive without distraction.
  3. **Generous Corner Radii & Soft Elevation**: Soft pill navigations, `2xl` & `3xl` rounded cards, and diffuse violet-tinted dropshadows.

---

## 2. Color Palettes & Design Tokens

### A. Dark Mode: *Midnight Lunar Library* (Default Preferred)
| Token Name | Hex / CSS Variable | Description & Intended Usage |
| :--- | :--- | :--- |
| `--canvas` | `#0E0C1B` | Deep velvet twilight canvas background |
| `--surface` | `#151229` | Slightly elevated container & modal background |
| `--card` | `#1A1633` | Primary card background with subtle purple tint |
| `--card-glass` | `rgba(26, 22, 51, 0.76)` | Translucent backdrop for overlays & dropdowns |
| `--primary` | `#8E72FF` | Glowing iris; primary actions, focus rings, progress fills |
| `--deep` | `#6D4BD9` | Royal amethyst; gradients, active nav tabs, headings |
| `--accent` | `#C4B5FD` | Moonlight lavender; secondary badges, highlights, links |
| `--highlight` | `rgba(167, 139, 250, 0.22)` | Borders, divider lines, and pill backdrops |
| `--ink` | `#F1EEFA` | Starlight white; primary high-contrast text |
| `--muted` | `#A29BB8` | Nebula gray; secondary metadata, captions, timestamps |
| `--border-subtle` | `rgba(167, 139, 250, 0.15)` | Delicate card outlines with soft violet reflectance |
| `--nebula-top` | `rgba(142, 114, 255, 0.18)` | Ambient floating aurora orbs (top-right drift) |
| `--nebula-bottom` | `rgba(251, 191, 36, 0.09)` | Warm hearth ember glow (bottom-left drift) |

### B. Light Mode: *Daylight Lavender*
| Token Name | Hex / CSS Variable | Description & Intended Usage |
| :--- | :--- | :--- |
| `--canvas` | `#F8F7FF` | Crisp, airy pale lavender-tinted white canvas |
| `--surface` | `#FFFFFF` | Pure white container & shell background |
| `--card` | `#FFFFFF` | Pure white card surfaces |
| `--card-glass` | `rgba(255, 255, 255, 0.88)` | Translucent frosted glass overlays |
| `--primary` | `#6C4CE8` | Vibrant royal indigo; primary buttons & active states |
| `--deep` | `#4B2DB8` | Deep twilight purple; brand headings & hero gradients |
| `--accent` | `#A78BFA` | Pastel wisteria; accent tags & progress fills |
| `--highlight` | `#D8CCFF` | Light lavender borders & badge backgrounds |
| `--ink` | `#1F1733` | Deep obsidian ink; primary text |
| `--muted` | `#6F6680` | Muted slate purple; secondary text |
| `--border-subtle` | `#E7E2FA` | Clean hairline dividers |

---

## 3. Typography & Text Hierarchy
- **Font Family**: Modern clean sans-serif (`Inter`, `system-ui`, `Arial, Helvetica, sans-serif`).
- **Headings**:
  - `h1` (Page Title): `text-2xl font-black tracking-tight text-ink`
  - `h2` (Section Title): `text-lg font-bold text-ink`
  - `h3` (Card / Modal Title): `text-base font-bold text-ink`
- **Badges & Overlines**:
  - `text-xs font-bold uppercase tracking-[.16em] text-accent`
- **Body & Captions**:
  - Body: `text-sm leading-6 text-ink`
  - Caption / Metadata: `text-xs text-muted`

---

## 4. Component Standards & Shapes

### A. Cards & Panels
- **Border Radius**: `rounded-2xl` (16px) or `rounded-3xl` (24px).
- **Border**: `1px solid var(--border-subtle)`.
- **Hover Micro-interaction**:
  - Dark Mode: Soft lift `translate-y-[-2px]`, border glow `border-accent/40`, and diffuse halo shadow `0 0 25px rgba(142, 114, 255, 0.16)`.
  - Light Mode: `shadow-float`, `border-primary/20`.

### B. Buttons & Interactive Elements
- **Primary Button**: `rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/25 hover:bg-deep transition`
- **Secondary / Ghost Button**: `rounded-xl border border-highlight/40 bg-surface/50 px-4 py-2 text-sm font-semibold text-ink hover:bg-highlight/30 transition`
- **Theme Switcher**: Smooth morphing Sun ⟷ Moon toggle with spring rotation and glowing ambient backdrop.

### C. Modals & Overlays
- **Backdrop**: `fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm`
- **Dialog Container**: `w-full max-w-md rounded-3xl bg-card border border-highlight/40 p-6 shadow-2xl text-ink`

---

## 5. Cozy Ambient Animations & Motion Tokens

1. **Nebula Drift (`18s ease-in-out infinite alternate`)**:
   Two organic blurred orbs (`.cosmic-orb`) floating continuously in the background to provide a living, breathing starry twilight feel.
2. **Velvet Theme Transition (`450ms cubic-bezier(0.4, 0, 0.2, 1)`)**:
   Mode switches apply a smooth velvet fade across background-color, border-color, box-shadow, and text color to eliminate any harsh flashing.
3. **Pulse Ring (`2.8s ease-in-out infinite`)**:
   Gentle breathing scale animation for readiness score circles and status indicators.
4. **Glare Hover (`glare-hover`)**:
   Diagonal shimmer sweep on primary cards when hovered.

---

## 6. Layout & Navigation Hierarchy
- **App Shell**:
  - **Left Rail**: 260px fixed sidebar with rounded-xl navigation pills (`pill-nav-effect`), active indicator glows, and workspace status.
  - **Top Navigation**: Breadcrumb trail, live academic indicators, offline resilience status, quick-action theme toggle button.
  - **Main Viewport**: Single-scroll container with responsive padding (`p-6 md:p-8`), max-width constraints on readable content, and dynamic card grids.
