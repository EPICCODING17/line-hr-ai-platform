# Design

## Theme
Modern SaaS product UI — clear, dependable, calm. Floating layout (sidebar and topbar detached from the viewport edges, sitting on a tinted canvas), cards with real but soft elevation, generous breathing room. Three themes switchable in real time: **Light**, **Dark**, **Dark 2** (warmer/violet-tinted dark). Cool-neutral palette so the brand blue reads as the single confident accent. No gradients anywhere.

## Color

Brand palette (committed, from product spec — used as semantic accents, never decoration):

| Role | Hex | Use |
|------|-----|-----|
| Primary (blue) | `#3c8cf3` | primary actions, current selection, links, info |
| Success (green) | `#05be8a` | approved/completed, positive metrics |
| Accent (purple) | `#745af2` | secondary highlights, AI-related surfaces |
| Danger (red) | `#ef5350` | rejected/failed, destructive |
| Muted (gray) | `#6c757d` | secondary text, neutral state |

Semantic tokens (CSS variables, resolved per theme in `globals.css`):

- `--bg` (canvas) · `--surface` (cards/panels) · `--surface-2` (sidebar/toolbar, second neutral layer) · `--surface-hover`
- `--ink` (primary text, AA on surface) · `--ink-muted` (secondary, still ≥4.5:1) · `--ink-subtle` (labels)
- `--border` · `--border-strong` · `--ring` (focus)
- `--primary` / `--primary-fg` / `--primary-soft` (tinted bg for soft buttons & selection)
- `--success` / `--danger` / `--accent` / `--warning` + matching `-soft`

**Light:** canvas cool near-white `#f4f6fa`, surface `#ffffff`, ink `#1a1d24`, muted `#5b6472` (AA-checked).
**Dark:** canvas `#13151a`, surface `#1c1f27`, sidebar `#181b22`, ink `#e8eaf0`.
**Dark 2:** violet-tinted — canvas `#17151f`, surface `#211d2d`, brighter primary `#6aa6ff` for contrast.

Strategy: **Restrained** (product default). One accent ≤10% of surface; everything else neutral.

## Typography
- **One family: Prompt** (Google, Thai + Latin), weights 300/400/500/600/700. No pairing — weight carries hierarchy.
- **Fixed rem scale** (product, not fluid): 12 / 13 / 14 (base) / 16 / 18 / 20 / 24 / 30 px. Ratio ~1.2.
- Numerals tabular in tables (`font-variant-numeric: tabular-nums`).
- Body/label color hits AA; no light-gray-for-elegance.

## Components
Shadcn-style primitives built on `cn()` + `cva`. Every interactive component ships: default / hover / focus / active / disabled / loading. Skeletons (not spinners) for loading; empty states that teach.

- **Card** — radius 18px, soft elevation. Light: shadow only, no border (avoid ghost-card). Dark: 1px border `--border`, minimal shadow. Never nest cards.
- **Button** — variants: primary, soft, ghost, outline, danger; radius 12px; sizes sm/md.
- **StatusBadge** — pill, `-soft` bg + solid text, color **+ label** (never color-only): Draft(gray) · Pending(amber) · Approved(green) · Rejected(red) · Cancelled(gray) · Completed(blue) · Failed(red).
- **DataTable** — no per-row edit/delete buttons. Whole row is the click target (keyboard-accessible). Selecting rows raises a **Bottom Action Toolbar** that slides up (transform/opacity, reduced-motion = fade). Works desktop + mobile.
- **Sidebar / Topbar** — floating, second neutral layer (`--surface-2`); sidebar collapses on mobile to a drawer.
- **ThemeSwitcher** — cycles Light/Dark/Dark2, persists to localStorage, applies `data-theme` on `<html>` with no flash.

## Layout
- **Floating app shell:** tinted canvas (`--bg`); sidebar and content are inset cards with gutters, not edge-to-edge.
- Radius scale: inputs/buttons 12px · cards/panels 18px · pills/badges full. (Stay 12–20px; avoid 32px+ over-rounding.)
- Responsive is **structural**: sidebar → drawer < 1024px; tables → horizontal scroll / stacked; bottom toolbar full-width on mobile. Mobile-first.
- Semantic z-index scale: dropdown(10) → sticky(20) → drawer(30) → toolbar(40) → modal-backdrop(50) → modal(60) → toast(70) → tooltip(80).

## Motion
- 150–250ms, ease-out (quart/expo). State and feedback only — no page-load choreography.
- Bottom Action Toolbar: slide-up + fade 200ms. Row hover/selection: 150ms bg.
- Full `prefers-reduced-motion: reduce` fallbacks (crossfade / instant).
