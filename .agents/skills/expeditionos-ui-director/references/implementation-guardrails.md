# Implementation Guardrails

## Preserve product behavior

A visual redesign must not accidentally change:

- route calculations,
- readiness scoring,
- Supabase permissions,
- collaboration rules,
- provider requests,
- Strava state,
- OpenAI evidence boundaries,
- GPX behavior,
- weather semantics.

## Component strategy

Before creating new components:

1. inspect current component patterns,
2. identify reusable primitives,
3. decide whether the change is composition or a new primitive,
4. avoid unnecessary abstractions for one-off layout.

## Styling strategy

Prefer existing Tailwind/project tokens.

Avoid arbitrary one-off values unless required by the design.

Do not introduce a new styling library.

## State

Preserve:

- loading,
- error,
- empty,
- partial,
- selected,
- hover/focus,
- stale/provider unavailable.

## Layout changes

It is acceptable to:

- merge cards,
- move components,
- create contextual rails,
- use tabs/segmented controls,
- collapse low-priority sections,
- change grid structure,
- adjust map/elevation composition.

It is not acceptable to remove functionality without explicit approval.

## No generic-dashboard drift

Avoid default patterns such as:

- four equally sized KPI cards followed by a grid of cards,
- excessive pill badges,
- every region in a rounded rectangle,
- ornamental gradients,
- dashboard charts that do not help route decisions.

Use the route itself as the organizing concept.
