# lettfeti.com — Personal Homepage

## TL;DR

> **Quick Summary**: Build a minimal, sharp personal homepage for Björn Orri Guðmundsson (CEO & Founder, Aftra) from zero — a single-page Astro static site deployed on Vercel at lettfeti.com.
>
> **Deliverables**:
> - Initialized Astro project with zero unnecessary dependencies
> - Single `src/pages/index.astro` with hero bio, headshot placeholder, social links (LinkedIn + GitHub), LinkedIn CTA button
> - `src/public/favicon.svg` — SVG favicon with "BÖ" initials
> - `astro.config.mjs` properly configured for static output and SEO
> - `README.md` with Vercel deployment instructions
>
> **Estimated Effort**: Quick (2-3 hours total)
> **Parallel Execution**: NO — 3 short sequential tasks (scaffold → build → verify)
> **Critical Path**: Task 1 → Task 2 → Task 3

---

## Context

### Original Request
Build lettfeti.com from scratch — a personal homepage for Björn Orri Guðmundsson. He's the CEO & Founder of Aftra (cybersecurity startup, Iceland). Wants minimal, investor-facing page as a starting point with room to grow later.

### Interview Summary

**Key Discussions**:
- **Aesthetic**: Minimal & sharp — clean typography, lots of whitespace, sharp layout
- **Audience**: Investors and business peers
- **Stack**: Astro + static, Vercel deployment
- **Color scheme**: Light background (off-white/cream), near-black text, accent = Aftra brand color (moody blue — a muted indigo-leaning blue)
- **Photo**: YES — include headshot (user will supply the file)
- **Social links**: LinkedIn + GitHub (lettfeti)
- **CTA**: "Connect on LinkedIn" as the primary CTA button
- **Content sections on launch**: Short hero bio ONLY — no blog, no projects yet
- **Hero text approach**: Name, title (CEO & Founder of Aftra), 2-line tagline

**Research Findings**:
- **Aftra Brand Guidelines (2025-04-28) — confirmed exact specs**:
  - Primary typeface: **Poppins** (geometric sans-serif, Google Fonts — free)
  - Secondary/display typeface: **Roboto Slab** (used for big headings on aftra.io)
  - Primary brand color: **Moody 300 = `#5A4DDE`** (vibrant indigo-violet)
  - Background: **Alabaster 100 = `#F8F8FA`** (near-white, very slightly warm)
  - Near-black text: **Iron 600 = `#18181E`** / **Steel 500 = `#232230`**
  - Midtone: **Gunpowder 400 = `#3F3D56`** (body text, muted elements)
  - Full Moody palette: 050=`#EFEDFC`, 100=`#A8A6F5`, 200=`#7E7CED`, 300=`#5A4DDE`, 400=`#342B99`, 500=`#211D49`
  - Neutral steel: N-Steel 1=`#FDFDFD`, Athens=`#F0F0F4`, Gainsboro=`#E2E2E9`, N-Steel 6=`#9C9CA2`
- LinkedIn bio copy ready to use (from profile)
- Astro 6 (current, Jan 2026) — minimal template is the correct starting point
- No Vercel adapter needed for static output

### Metis Review

**Identified Gaps (addressed)**:
- Contact pathway: resolved — "Connect on LinkedIn" CTA button
- Photo question: resolved — user confirmed YES (headshot will be provided by user)
- Social links: resolved — LinkedIn + GitHub only (no Twitter/X)
- Accent color: resolved — Aftra brand moody blue
- Bio text: confirmed from LinkedIn, may need slight refinement (handled in task)
- Favicon: resolved — SVG with initials "BÖ"
- OG image: resolved — minimal OG tags (no custom image for v1, auto-text OG)
- Font: resolved — system font stack (zero network cost, matches Vercel/GitHub/Apple aesthetic)

---

## Work Objectives

### Core Objective
Build a single-page Astro static site that serves as Björn's professional homepage — clean, minimal, investor-ready. Gets deployed to Vercel at lettfeti.com with custom domain.

### Concrete Deliverables
- `/` — One-page personal homepage with hero section
- `astro.config.mjs` — Static output, SEO configured
- `public/favicon.svg` — SVG favicon
- `public/photo.jpg` — Placeholder (user replaces with headshot)
- `README.md` — Vercel deployment steps

### Definition of Done
- [ ] `npm run build` exits with 0 errors
- [ ] `npm run preview` serves the page correctly
- [ ] Page contains "Björn Orri Guðmundsson" (including ö and ð correctly)
- [ ] Page contains "CEO & Founder" and "Aftra"
- [ ] LinkedIn and GitHub links present and open in new tab
- [ ] OG tags present (`og:title`, `og:description`, `og:url`)
- [ ] Favicon loads (HTTP 200 on `/favicon.svg`)
- [ ] Page renders correctly at 375px (mobile) and 1440px (desktop) — Playwright screenshots
- [ ] Zero `<script>` tags in built output
- [ ] Lighthouse: Performance ≥ 95, Accessibility = 100, SEO ≥ 90

### Must Have
- Single `src/pages/index.astro` with all HTML + CSS in one file
- `<html lang="en">`, `<meta charset="utf-8">`, `<meta name="viewport">`
- OG tags: `og:title`, `og:description`, `og:url`, `og:type`
- System font stack (no external font loading)
- Responsive: works at 375px and 1440px
- Headshot image with proper `alt` text
- LinkedIn CTA as a styled button/link
- Social links: LinkedIn + GitHub (lettfeti), `target="_blank" rel="noopener noreferrer"`
- WCAG AA color contrast (4.5:1 minimum)
- Favicon SVG
- Aftra mentioned in bio with link to aftra.io

### Must NOT Have (Guardrails)
- NO Tailwind, Bootstrap, or any CSS framework
- NO npm dependencies beyond Astro core
- NO client-side JavaScript (zero `<script>` in output)
- NO dark mode toggle
- NO animations or transitions
- NO contact form (links only)
- NO blog/content collections/MDX infrastructure
- NO sitemap (meaningless for 1 page)
- NO analytics or tracking
- NO component library or design system abstractions
- NO separate pages (`/about`, `/contact`, etc.)
- NO `<div>` soup — use semantic HTML (`<main>`, `<header>`, `<h1>`, `<p>`, `<a>`)
- NO pre-built abstractions for "future extensibility" — clean file structure only
- NO CSS in separate files — embed in `<style>` block in the Astro file
- DO NOT automate Vercel setup, DNS, or domain configuration — documentation only

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: NO (greenfield, no test setup)
- **Automated tests**: None (not needed for a single static HTML page)
- **Framework**: N/A

### QA Policy
Every task includes agent-executed QA via Bash (curl + grep) and Playwright screenshots.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Static site / HTML**: Use Bash (curl) — fetch page, assert content with grep
- **Visual / responsive**: Use Playwright — screenshot at 375px and 1440px
- **Build verification**: Use Bash (npm run build, npm run preview)
- **Lighthouse**: Run via `npx lighthouse` CLI

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — scaffolding):
└── Task 1: Initialize Astro project + configure astro.config.mjs [quick]

Wave 2 (After Task 1 — build the page):
└── Task 2: Build index.astro — full page with hero, bio, photo, social links, favicon [visual-engineering]

Wave 3 (After Task 2 — verify everything):
└── Task 3: QA, Lighthouse, screenshots, README deployment instructions [quick]

Critical Path: Task 1 → Task 2 → Task 3
```

> Note: This is a 3-task sequential plan because each task strictly depends on the previous. The site is one file — parallelism would artificially split a single ~150-line file.

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 | — | 2 |
| 2 | 1 | 3 |
| 3 | 2 | — |

### Agent Dispatch Summary

- **Wave 1**: Task 1 → `quick`
- **Wave 2**: Task 2 → `visual-engineering` + `playwright` skill
- **Wave 3**: Task 3 → `quick` + `playwright` skill

---

## TODOs

---

## Final Verification Wave

> Runs after ALL implementation tasks. All 3 agents run in PARALLEL. ALL must APPROVE.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify it exists in the built output (grep dist/, curl localhost). For each "Must NOT Have": search built dist/ for forbidden patterns. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [3/3] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `quick`
  Run `npm run build` and check zero errors. Review `src/pages/index.astro`: no `as any`, no JS in `<script>` tags, no `console.log`, no commented-out code, no unused imports, no `<div>` soup (semantic HTML used). Check CSS: under 120 lines, no framework classes, self-contained.
  Output: `Build [PASS/FAIL] | Semantic HTML [PASS/FAIL] | CSS clean [PASS/FAIL] | VERDICT`

- [ ] F3. **Visual & Accessibility QA** — `visual-engineering` + `playwright` skill
  Start dev server. Screenshot at 375px and 1440px widths. Run Lighthouse CLI. Assert: Performance ≥ 95, Accessibility = 100, SEO ≥ 90. Check: no horizontal overflow, text readable, headshot visible, CTA button prominent, social links reachable by keyboard tab.
  Output: `Screenshots captured | Lighthouse [P:XX A:XX SEO:XX] | Overflow [NONE/FOUND] | VERDICT`

---

## Commit Strategy

- **After Task 1**: `chore: initialize Astro project with minimal template`
- **After Task 2**: `feat: add personal homepage hero section`
- **After Task 3**: `docs: add Vercel deployment instructions`

---

## Success Criteria

### Verification Commands
```bash
# Build succeeds
npm run build
# Expected: exit code 0, no errors

# Page contains expected content
npm run preview &
sleep 3
curl -s http://localhost:4321/ | grep "Björn Orri"
# Expected: match found

# No client-side JS in output
grep -r "<script" dist/ | grep -v "type=\"application/ld+json\"" | wc -l
# Expected: 0

# OG tags present
curl -s http://localhost:4321/ | grep 'og:title'
# Expected: match found

# Favicon 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/favicon.svg
# Expected: 200

# UTF-8 characters render
curl -s http://localhost:4321/ | grep "Guðmundsson"
# Expected: match found (not mojibake)
```

### Final Checklist
- [ ] All "Must Have" present (photo, bio, LinkedIn CTA, GitHub link, OG tags, favicon, Aftra link)
- [ ] All "Must NOT Have" absent (no JS, no CSS framework, no extra pages, no form, no analytics)
- [ ] Build passes with zero errors
- [ ] Lighthouse: Performance ≥ 95, Accessibility = 100, SEO ≥ 90
- [ ] Evidence files exist in `.sisyphus/evidence/`
- [ ] README contains step-by-step Vercel deployment instructions
