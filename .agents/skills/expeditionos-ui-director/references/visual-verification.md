# Visual Verification Workflow

Use this after meaningful UI implementation.

## Before

1. Start the app.
2. Open the target page.
3. Capture the current layout at the primary desktop size.
4. Note:
   - focal point,
   - map size,
   - panel count,
   - vertical scroll,
   - primary action,
   - obvious overflow.

## After implementation

Capture at:

- 1920x1080
- 1440x900
- 1280x800
- 768x1024
- 390x844

If automation supports only a subset, prioritize:

- 1440x900,
- 390x844.

## Review questions

- Is the map more or less prominent?
- Is the primary action obvious?
- Are critical warnings still visible?
- Did any information become harder to find?
- Are contextual controls discoverable?
- Did card count decrease where appropriate?
- Did typography become easier to scan?
- Does the page feel calmer without becoming empty?
- Is there horizontal overflow?
- Are drawers/sheets usable on small screens?
- Are empty/loading states still coherent?

## Refine once

Do not stop immediately after the first screenshot.

Make one deliberate refinement pass for:

- spacing,
- alignment,
- type scale,
- control sizing,
- rail width,
- map height,
- border/surface weight.

Then capture again.

## Evidence

In the completion report, state which sizes were actually viewed.

Do not claim visual verification if no rendered UI was inspected.
