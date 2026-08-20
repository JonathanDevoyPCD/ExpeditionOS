---
name: expeditionos-ui-director
description: Audit, redesign, implement, or refine ExpeditionOS UI hierarchy, map-led layouts, responsive behavior, and visual consistency. Use for ExpeditionOS visual work or when a supplied screen feels dense or unclear; preserve product behavior and defer backend decisions to the project developer rules.
---

# ExpeditionOS UI Director

Make ExpeditionOS easier to understand and operate as an expedition command centre. Preserve its dark outdoor identity while making the route, current decision, blockers, and next action visually obvious.

This skill supplements the repository `SKILL.md`. Read that project skill first. Do not change data access, calculations, RLS, providers, authentication, or private-data boundaries merely to simplify a screen.

## Select the mode

- **Audit:** inspect and explain hierarchy, density, task clarity, responsiveness, and the strongest changes. Do not edit unless asked. Read [audit-rubric.md](references/audit-rubric.md); use [ui-audit-report.md](templates/ui-audit-report.md) only when a scored report helps.
- **Redesign:** propose the target composition, persistent/contextual content, actions, and responsive behavior without changing business logic.
- **Implement:** audit first, implement the smallest coherent approved slice, verify it rendered, and refine after inspection.
- **Refine:** tune spacing, typography, alignment, surfaces, controls, and states without unnecessary structural change.
- **Responsive:** reconsider priority and interaction rather than stacking the desktop UI. Read [responsive-rules.md](references/responsive-rules.md).
- **Consistency:** consolidate equivalent patterns and tokens without launching a sweeping design-system rewrite.

For meaningful implementation, also read [implementation-guardrails.md](references/implementation-guardrails.md) and [visual-verification.md](references/visual-verification.md).

## Establish the real task

Before changing a screen:

1. Inspect the relevant components and rendered screen when browser access exists.
2. Name the rider's primary goal and the one or two dominant actions.
3. Identify what must remain visible, especially blockers, unknowns, failures, and safety-relevant guidance.
4. Identify duplicated, mutually contextual, or low-frequency content that can move one interaction away.
5. Distinguish structural problems from cosmetic ones.

The included [current dashboard audit](references/current-dashboard-audit.md) and [baseline screenshot](assets/current-dashboard-baseline.png) are dated hypotheses. Re-evaluate them against the current build before acting.

## ExpeditionOS composition rules

- On route-led screens, make the map/route the primary spatial canvas.
- Prefer one contextual region for Intelligence, Copilot, Services, and selected map details instead of permanently stacking equal utilities.
- Keep scalar route facts compact unless they contain meaningful interaction.
- Use spacing, typography, alignment, dividers, and background shifts before adding another bordered card.
- Give each context one dominant action; distinguish secondary and tertiary actions.
- Keep Route Intelligence, Accommodation, and Weather tied to the active trip. Keep deeper Stays, Gear, and Funds work in their sidebar workspaces.
- Connect map, elevation, stages, stops, and weather spatially where useful.
- Progressive disclosure may hide detail, never critical blockers or missing evidence.

## Visual language

- Preserve the established dark teal palette unless the user requests a rebrand.
- Use colour for selection, interaction, route/stage identity, and status—not to compensate for weak hierarchy.
- Reduce repeated dark-teal boxes, excessive pills, nested borders, micro-labels, and equally weighted surfaces.
- Keep important supporting text readable; reserve tiny uppercase tracking for restrained metadata.
- Avoid generic admin-dashboard KPI grids, neon/gradient decoration, and gaming-HUD styling.
- Reuse existing Tailwind patterns and dependencies. Do not introduce another styling or component system for ordinary UI work.

## Interaction and states

Prefer contextual responses: selecting a stage, segment, place, stay, or forecast should update the related map/elevation/context rather than open more permanent panels.

Preserve and design loading, empty, partial, stale, unauthenticated, read-only, error, and success states. Maintain labels, keyboard access, visible focus, touch targets, and status text that does not rely on colour alone.

## Verification

For implementation work:

1. Capture or inspect the existing screen.
2. Implement and run the relevant tests, typecheck, lint, and build.
3. Inspect the result at a representative laptop size and narrow mobile/tablet size.
4. Check map size, focal order, overflow, warnings, actions, controls, and all affected states.
5. Make one deliberate refinement pass after seeing the rendered result.

Never call a visual change improved based only on compilation. If authenticated or rendered verification is unavailable, say exactly what remains unverified.

## Completion report

Report the design intent, changed composition, preserved behavior, actual viewport/check evidence, and meaningful remaining issues.
