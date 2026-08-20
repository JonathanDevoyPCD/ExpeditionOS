# Current ExpeditionOS Dashboard Audit

Baseline: `assets/current-dashboard-baseline.png`

This is the baseline visual audit used when the UI Director skill was created. It predates later command-centre work and must be checked against the current rendered dashboard before implementation.

## What already works

- The dark teal ExpeditionOS palette is distinctive and appropriate.
- The left-side navigation is clear and consistently positioned.
- The route title and expedition context are understandable.
- The map, elevation profile, itinerary, readiness, Copilot, and services all expose useful real functionality.
- The interface already feels purpose-built rather than like a stock white admin dashboard.
- Route and stage information are visually connected to the mapping experience.

The redesign should preserve these strengths.

## Main issue

The interface does not primarily suffer from bad colours.

It suffers from **too many similarly weighted regions competing for attention**.

The result is a screen that feels busy even though individual elements are reasonably designed.

## 1. Weak focal hierarchy

The user should visually enter through the route/map.

Instead, the eye competes between:

- four metric cards,
- the map,
- Route Intelligence,
- Expedition Copilot,
- Route Services,
- elevation,
- the itinerary,
- the resupply warning.

Many elements use similar:

- border strength,
- background value,
- corner radius,
- heading size,
- spacing.

Therefore visually important and secondary content receive nearly the same emphasis.

## 2. Too many boxes

The page uses a repeated dark-card treatment extensively.

There are cards inside larger cards and bordered blocks inside bordered blocks.

This creates "container noise".

Recommendation:

- use fewer surfaces,
- group related content with whitespace and alignment,
- reserve stronger cards for interactive/contextual regions,
- use dividers or typography for simple grouping.

## 3. Map is important but not dominant enough

The map is the strongest product-specific element on the screen, but the permanent right column significantly reduces its width and competes with it.

Recommendation:

- make the map the primary visual canvas,
- treat the right side as a single contextual rail,
- allow Intelligence / Copilot / Services / selected place details to occupy that context region rather than permanently stacking separate cards.

## 4. Metric cards consume too much space

Distance, ascent, highest point, and moving estimate are useful, but four large cards consume a major area above the map.

Recommendation:

convert them into a compact route-facts rail, for example:

`389 km · ↑1,375 m · ▲334 m · 23h 22m`

with clear labels and enough spacing to remain readable.

## 5. Right rail is fragmented

The right column contains multiple independent utilities.

This makes the column feel like a stack of mini dashboards.

Recommendation:

create one contextual rail with clear mode switching:

- Intelligence
- Copilot
- Services
- Place/segment context

Only the relevant tool should dominate at a time.

Critical warnings should remain visible regardless of mode.

## 6. Typography is too small in secondary areas

There are several micro-labels and low-contrast supporting lines.

While metadata can be small, the cumulative effect increases cognitive load.

Recommendation:

- increase the gap between body text and metadata,
- reduce unnecessary uppercase micro-labels,
- improve contrast for important secondary text,
- use size/weight rather than more borders to create hierarchy.

## 7. The light map creates a visual discontinuity

The bright basemap is dramatically lighter than the surrounding shell.

This can be useful for map legibility, but it also feels visually detached.

Recommendation:

- investigate a darker or more Expedition-compatible map style where allowed,
- or reduce surrounding visual competition so the bright map intentionally becomes the hero.

Do not violate map-provider policy or attribution requirements for aesthetic reasons.

## 8. The route itinerary is visually large

The itinerary is important, but it occupies a very tall secondary region.

With few/no planned stops, much of the area is empty state.

Recommendation:

- allow the itinerary to collapse to a compact stage summary,
- expand when the rider is actively planning stops,
- or make the detailed editor a focused region rather than permanently consuming the full page.

Do not hide resupply blockers or critical warnings.

## 9. Too much simultaneous capability

The current screen exposes almost every route-planning capability at once.

This increases discoverability but lowers task clarity.

Recommendation:

use progressive disclosure:

- route overview first,
- current map context second,
- deeper planning tools through obvious contextual controls.

## Suggested Target Composition

A direction worth testing:

### Top

- expedition title + status/context
- one clear primary route action
- compact route metrics rail

### Main

Large map-led canvas.

Right side:
one contextual rail with mode switching.

### Map footer

Integrated elevation profile.

### Secondary section

Route intelligence / itinerary / weather summaries with strong prioritization.

### Detailed tools

Expand or open deeper workflows when the rider chooses to work on them.

## Design objective

Do not make the screen empty.

Make the visual path obvious:

1. What route is this?
2. Where does it go?
3. What does the rider need to know right now?
4. What needs attention?
5. What can the rider do next?
