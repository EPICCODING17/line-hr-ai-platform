# Product

## Register

product

## Users
- **Employees** — interact almost entirely through LINE (chat + LIFF). Low patience, mobile-first, want a leave/OT/check-in/document request done in seconds.
- **Managers** — approve/reject from LINE; occasionally open the dashboard.
- **HR / Company Admin** — live in the Web Dashboard: manage employees, policies, approvals, reports. Power users, data-dense screens, daily use.
- **Platform operators (SaaS owner)** — separate platform dashboard: tenants, plans, usage, subscriptions.

The dashboard's primary job: let HR move through high-volume approval and management tasks quickly and confidently, on desktop and mobile.

## Product Purpose
A multi-tenant SaaS HR assistant that runs on LINE OA with AI agents (Leave, OT, Attendance, HR Document). The web dashboard is the control center HR uses to configure the system and act on what the AI/LINE flow produces. Success = HR trusts the numbers, approvals take seconds, and the tool disappears into the daily workflow.

## Brand Personality
Trustworthy and professional. Three words: **clear, dependable, calm.** It should feel like a tool an HR team relies on for payroll-adjacent decisions — quiet confidence, not flashy. Tone in UI copy: polite Thai, concise, never cute.

## Anti-references
- **AI-generic / cookie-cutter SaaS** — no multi-stop gradients, no matched icon-card grids, no template-from-a-generator look.
- **Childish / cartoonish** — no playful mascots, doodles, bubbly illustration.
- **Government / legacy enterprise** — not the dated, cramped, gray Thai gov-portal aesthetic.
- **Cluttered / dense-to-a-fault** — breathing room over information overload; density only where HR genuinely needs it (tables).

## Design Principles
1. **Trust through clarity.** Every number, status, and approval action is unambiguous. No decoration competes with data.
2. **The tool disappears.** Earned familiarity over novelty — standard affordances, consistent vocabulary screen to screen.
3. **Calm density.** Tables can be dense; everything around them breathes. Whitespace is a feature.
4. **Mobile is first-class.** HR and managers act from phones; the dashboard is not a desktop afterthought.
5. **One system, many tenants.** Theming and branding adapt per company without forking the component library.

## Accessibility & Inclusion
- Target **WCAG 2.1 AA**: body text ≥4.5:1, large/UI text ≥3:1, visible focus rings on all interactive elements.
- Thai + Latin typography must both render cleanly (font Prompt covers both).
- Full `prefers-reduced-motion` support; motion only conveys state.
- Status is never color-only — pair color with label/icon (color-blind safe).
