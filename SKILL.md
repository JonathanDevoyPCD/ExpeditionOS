---
name: expeditionos-developer
description: Develop, debug, extend, and verify the ExpeditionOS codebase. Use this skill whenever working in the ExpeditionOS repository on Next.js UI or route handlers, route planning, GPX processing, MapLibre maps, Valhalla routing, OpenStreetMap/Overpass/Nominatim data, Google Maps/Places/Weather integrations, Supabase authentication or RLS, Strava synchronization and readiness, OpenAI-assisted planning, trip collaboration, logistics, gear, funds, privacy, or Vercel deployment.
---

# ExpeditionOS Developer

Act as the senior engineer responsible for ExpeditionOS.

ExpeditionOS is a route-led cycling, bikepacking, and adventure-planning application. It combines deterministic route and readiness analysis with mapping, rider history, logistics, collaboration, weather, and AI-assisted interpretation.

Your primary job is to extend the existing product safely without weakening its privacy boundaries, evidence model, provider constraints, or established architecture.

## 1. Start Every Task With Project Discovery

Before editing code:

1. Read `AGENTS.md`.
2. Read `package.json` and treat the installed versions and lockfile as the source of truth.
3. Read `README.md`.
4. Read the relevant project documentation:
   - `docs/EXPEDITION_OS_PLAN.md`
   - `docs/READINESS_LOGISTICS_ROADMAP.md`
   - `LaterBuilds.md`
   - `docs/strava-setup.md` when touching Strava
   - `docs/supabase-email-otp.md` when touching authentication or OTP
   - `GEARLIST.md` and `Bikepacking_Checklist.pdf` when touching Gear or packing workflows
5. Run `git status --short` and inspect existing user changes before editing.
6. Inspect the complete execution path related to the request before changing it.
7. Read nearby tests and reuse existing project patterns.
8. For Next.js behavior, read the relevant documentation shipped in `node_modules/next/dist/docs/` before implementing or changing framework-specific code.

Do not assume framework behavior from memory when the installed Next.js version can provide the authoritative local documentation.

Do not overwrite, revert, reformat, or "clean up" unrelated user changes.

## 2. Current Technical Baseline

Always re-check `package.json` before relying on these versions. At the time this skill was created, ExpeditionOS uses:

- Next.js 16.x App Router
- React 19.x
- TypeScript 5.x in strict mode
- Tailwind CSS 4.x
- MapLibre GL JS
- Supabase JS and `@supabase/ssr`
- OpenAI JavaScript SDK
- `fast-xml-parser`
- Lucide React
- Node test runner
- ESLint
- Vercel deployment

TypeScript uses the `@/* -> ./src/*` alias.

Do not introduce a second framework, state-management system, CSS framework, mapping library, database client, or AI SDK unless the task genuinely requires it and the user has approved the architectural change.

Prefer existing dependencies and project utilities over new packages.

## 3. Core Product Invariant

The central ExpeditionOS rule is:

> Calculations own the facts. AI owns interpretation and explanation.

Deterministic code must remain authoritative for:

- GPX distance
- ascent and descent
- elevation
- grade
- stage load
- route geometry
- route discontinuities
- readiness factors
- comparable activity metrics
- weather-derived calculations
- cost totals
- member balances
- other numeric facts the application can calculate directly

OpenAI may:

- interpret natural-language adventure requests
- produce typed route/adventure intent
- explain deterministic results
- summarize trade-offs
- identify missing information
- generate readable reports from validated evidence
- propose questions or adjustments

OpenAI must not:

- invent roads, trails, access rights, water points, accommodation, or services
- calculate authoritative GPX metrics when deterministic code can do so
- manufacture Strava evidence
- cite activities not included in the evidence packet
- treat unknown terrain as confirmed terrain
- convert uncertainty into certainty
- guarantee route safety or viability
- infer medical fitness
- replace deterministic readiness scoring

The core product must degrade usefully when OpenAI is unavailable.

## 4. Normalized Route Architecture

ExpeditionOS accepts multiple route sources, including:

- uploaded GPX
- bundled/demo GPX
- manual map anchors
- explicit place searches
- natural-language Copilot plans

These sources should converge on the same normalized route model and downstream analysis pipeline.

Do not create separate incompatible analysis logic for each route source unless there is a strong technical reason.

When adding a new route source:

1. validate the source,
2. transform it into the normalized route representation,
3. reuse the existing route metrics pipeline,
4. reuse stage/itinerary logic,
5. reuse readiness analysis,
6. reuse mapping and export behavior.

Preserve original geometry where available and derive simplified/display geometry separately.

## 5. Server and Client Boundaries

Treat server/client separation as a security boundary.

Keep these server-only:

- `OPENAI_API_KEY`
- `GOOGLE_API_KEY`
- `SUPABASE_SECRET_KEY`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_TOKEN_ENCRYPTION_KEY`
- `STRAVA_WEBHOOK_VERIFY_TOKEN`
- Strava access and refresh tokens
- provider credentials that are not explicitly browser-safe

The Supabase publishable key may be used in the browser as intended. The Supabase secret key must never enter a client bundle.

Before exposing any environment variable to client code, confirm that it is intentionally public.

Never log secrets, OAuth tokens, passport/ID information, medical details, private booking references, or sensitive profile payloads.

Never commit `.env.local` or real credentials.

## 6. Supabase, Authentication, and RLS

Supabase is a security boundary, not merely persistence.

For every user-owned or trip-owned table:

- preserve Row Level Security,
- reason about `SELECT`, `INSERT`, `UPDATE`, and `DELETE` separately,
- test ownership and membership boundaries,
- do not rely only on UI hiding,
- do not replace RLS with client-side permission checks.

Existing collaboration roles include owner, editor/contributor, and viewer semantics. Preserve the established role model instead of inventing parallel permissions.

Important privacy invariants:

- Strava history belongs to the rider and remains private even on shared trips.
- Readiness results based on private Strava history remain private to that rider unless the product explicitly defines a safe shared derivative.
- Contact information and travel-document data remain owner-private.
- Emergency-profile sharing is explicit and per-trip.
- Do not broaden emergency access as a side effect of trip membership.
- Sensitive profile information requires stricter handling than ordinary route data.
- Account export and account deletion must remain functional when schema changes are introduced.

When adding or changing schema:

1. create a versioned migration,
2. add indexes and constraints deliberately,
3. add or update RLS,
4. inspect all affected queries,
5. test with at least two distinct user identities when the change affects isolation,
6. verify owner/member/non-member behavior.

Never use the Supabase secret key as a shortcut around a broken RLS design in normal user flows.

## 7. Strava Rules

All Strava OAuth and token work is server-side.

Preserve:

- encrypted token storage,
- rotating refresh-token handling,
- owner isolation,
- rate-limit awareness,
- webhook verification,
- webhook deauthorization cleanup,
- safe disconnect behavior.

Do not persist raw sensor streams merely because they are available. Existing readiness design uses selected streams transiently and stores derived summaries where appropriate.

For readiness work:

- prefer recent, relevant cycling evidence,
- distinguish road/hybrid/mountain-bike relevance where available,
- make sparse or mismatched history lower confidence,
- keep weak factors visible even when the overall score is high,
- do not turn physiology signals into medical advice,
- do not silently make heart-rate/power observations score-changing unless the scoring specification explicitly says so.

Webhook handlers should acknowledge provider requests promptly and avoid unnecessary long blocking work.

Respect Strava short-term and daily rate limits. Do not create loops that fetch activity details or streams indiscriminately.

## 8. Mapping, Routing, Elevation, and Places

### Map rendering

MapLibre is the primary interactive map renderer.

Do not replace MapLibre or introduce a second map architecture for a small feature.

### Routing

Valhalla is the current primary bicycle-routing provider.

Keep routing behind a project abstraction/internal adapter where possible so provider changes do not leak throughout the UI.

Long trips may be split into multiple routing stages. Preserve route continuity and avoid silently stitching disconnected geometry.

### Elevation

Open-Meteo elevation is used for sampled route elevation.

Treat provider elevation as measured/enriched data with known limits. Never invent missing elevation.

### Nominatim

Use explicit server-side searches, caching, and conservative request behavior.

Do not implement aggressive autocomplete or high-frequency requests against public Nominatim infrastructure.

### OpenStreetMap / Overpass

OpenStreetMap is the broad discovery layer for:

- food
- fuel
- groceries
- shops
- drinking water
- bicycle services
- lodging
- toilets
- pharmacies
- outdoor/cultural highlights

Community data may be incomplete or stale. UI copy must not represent contributor-supplied hours, services, access, or contact data as guaranteed current information.

Preserve caching/viewport quantization and avoid re-querying Overpass on every tiny map movement.

Public Overpass infrastructure must not be treated as guaranteed production infrastructure.

### Google Places

Google Places is an on-demand enrichment source, not the broad default discovery engine.

Do not query Google for every OSM marker or every map pan.

Keep Google-derived content clearly attributed and visually distinguishable where required.

Do not persist Google content beyond current provider terms.

Do not plot Google-only place results on a non-Google map when provider policy prohibits it. If a full Google Places marker layer is required, use an approved Google map mode rather than silently mixing provider data.

### Google map tiles

Google-backed Roadmap, Terrain, and Satellite layers must continue through the established server/proxy/session architecture where required.

Never expose a server-restricted Google credential merely to make a client map feature easier.

## 9. Weather Rules

Google Weather API is the preferred production forecast source in the current roadmap.

Open-Meteo may be used as a fallback or explicit comparison source.

Do not silently blend forecasts from different providers into one synthetic forecast.

Every forecast surface should preserve:

- provider identity,
- data/update time,
- forecast age,
- stale/unavailable state.

Route-aware weather should consider the rider's expected position/time rather than applying one town forecast to an entire multi-day route.

Useful deterministic cycling calculations include:

- headwind/tailwind/crosswind from route bearing,
- gust exposure,
- precipitation windows,
- heat/cold exposure,
- visibility,
- daylight.

Application-generated warnings are planning guidance. Do not label them as official weather alerts unless they come from an authoritative alert provider.

Trips beyond the provider forecast horizon must clearly distinguish seasonal guidance from an actual forecast.

## 10. Logistics, Gear, Stays, and Funds

The dashboard is the command centre for the selected trip. Deeper cross-trip work belongs in established sidebar workspaces.

Current product organization includes:

- Route Intelligence
- Accommodation summary
- Weather
- Stays
- Gear
- Funds

Do not turn every new feature into another dashboard tab.

### Stays

Manual candidates and provider search links are useful even when live inventory is unavailable.

Do not claim:

- live availability,
- live pricing,
- cancellation terms,
- booking confirmation,

unless those facts come from an approved live provider.

Keep booking references and private confirmation notes restricted to authorized trip members.

### Gear

Preserve:

- personal vs shared gear,
- assignments,
- quantities,
- packed/missing state,
- critical-item visibility,
- weight calculations.

A high overall packing percentage must not hide a missing critical item.

For catalogue and checklist work:

- separate reusable catalogue definitions from trip-specific gear records,
- copy catalogue defaults into a trip item so later catalogue edits do not silently rewrite existing trip plans,
- keep packing state separate from acquisition state such as owned, needed, borrowed, or to buy,
- prefer a searchable visual catalogue and multi-select add flow over repetitive manual-entry forms,
- keep the trip checklist compact and make uncommon controls progressively available,
- label estimated weights honestly and allow an actual-weight override,
- distinguish fixed gear from consumables such as food, water, and fuel,
- use project-owned, generated, or properly licensed generic item images rather than copying retailer or checklist imagery,
- treat retailer links as optional outbound assistance and never scrape retailer listings, pricing, ratings, or images without an approved API or explicit permission.

### Funds

Funds currently tracks and reconciles costs; it does not hold or transfer money.

Preserve:

- estimated vs actual amounts,
- payer assignments,
- participant splits,
- per-trip/per-day/per-person totals,
- balances,
- private references.

Do not implement payment collection or stored-value behavior without an explicit separate product/security/regulatory decision.

## 11. API Surface

The API surface changes as ExpeditionOS grows. Before adding a route, enumerate the current handlers rather than relying on a static list:

```powershell
rg --files -g 'route.ts' -g 'route.js' src/app/api
```

Check whether an existing route or service already owns the responsibility, and inspect its callers and tests before changing it.

Keep route handlers thin where practical. Put reusable deterministic domain logic in reusable server modules rather than duplicating it across handlers.

## 12. Feature Workflow

For a new feature:

1. Translate the request into user-visible behavior and invariants.
2. Locate the existing domain owner.
3. Trace the data flow end-to-end.
4. Identify privacy/security/provider implications.
5. Check `LaterBuilds.md` before implementing anything that may be intentionally deferred.
6. Reuse existing data structures and services.
7. Implement the smallest coherent vertical slice.
8. Add or update tests.
9. Run targeted tests.
10. Run project quality gates.
11. Verify the actual UI/API flow.
12. Summarize what changed and any provider/manual configuration still required.

Do not build speculative infrastructure for features that were not requested.

## 13. Debug Workflow

When debugging:

1. Reproduce the failure when possible.
2. Read logs and the complete stack trace.
3. Trace the request/event from entry point to failure.
4. Identify the root cause before patching.
5. Prefer the smallest safe fix.
6. Add a regression test when practical.
7. Re-run the broken flow.
8. Run broader checks for affected subsystems.

Do not "fix" symptoms by swallowing errors, returning fake success, weakening types, disabling lint rules, bypassing RLS, or adding arbitrary delays.

## 14. UI Workflow

Match the existing ExpeditionOS visual system and map-led expedition identity.

Before building a new UI:

- inspect nearby components,
- reuse existing spacing and typography,
- reuse card/control patterns,
- preserve responsive behavior,
- preserve accessibility,
- preserve loading/empty/error states.

Do not make the product look like a generic admin template.

Prefer functional density appropriate for route planning without sacrificing clarity.

When changing map UI, verify interaction in both desktop and narrower responsive layouts.

## 15. Next.js Rules

This repository's `AGENTS.md` explicitly warns that the installed Next.js version may contain APIs and conventions that differ from model training knowledge.

Therefore:

- consult `node_modules/next/dist/docs/` for relevant framework work,
- respect App Router server/client component boundaries,
- do not add `"use client"` reflexively,
- keep secrets and private provider calls in server code,
- use route-handler APIs supported by the installed version,
- heed deprecation warnings,
- preserve generated Next.js agent instructions in `AGENTS.md`.

Do not remove the generated Next.js agent block just because it appears as an uncommitted change.

## 16. TypeScript and Code Quality

Keep TypeScript strict.

Do not solve errors with:

- broad `any`,
- `@ts-ignore`,
- unnecessary non-null assertions,
- unsafe type casts,
- disabling lint rules,

unless there is a documented, narrow reason.

Prefer:

- explicit domain types,
- validation at external boundaries,
- small pure deterministic helpers,
- typed provider adapters,
- structured error responses,
- reusable server utilities.

Validate untrusted inputs from:

- GPX/XML,
- forms,
- search queries,
- route parameters,
- provider webhooks,
- OAuth callbacks,
- API responses.

## 17. Provider Failure and Cost Discipline

ExpeditionOS integrates with free/community and paid providers. Every integration must have a failure strategy.

When changing provider-backed functionality, consider:

- request cost,
- quotas,
- rate limits,
- cacheability,
- attribution,
- storage restrictions,
- provider outage,
- stale data,
- geographic coverage.

Do not add a paid API dependency merely because it makes implementation easier.

Check `LaterBuilds.md` for features intentionally blocked by credentials, licensing, approval, infrastructure, or cost.

When a provider is unavailable, preserve honest degraded behavior rather than fabricating data.

## 18. Privacy and Safety Language

ExpeditionOS may contain:

- identity details,
- travel documents,
- medical aid details,
- allergies,
- blood type,
- doctor details,
- emergency contacts,
- private activity history.

Treat these as sensitive application data.

Do not expose them in logs, analytics, AI prompts, public routes, collaboration payloads, or browser responses unless the feature explicitly requires that specific field.

Route/readiness output must use calibrated language such as:

- viable,
- viable with changes,
- insufficient information,
- not currently viable,
- unknown,
- low/moderate/high confidence.

Avoid absolute safety claims.

ExpeditionOS is a planning tool, not a medical assessment or emergency service.

## 19. Local Windows Development

The primary local environment is Windows 11 with VS Code and Codex.

Prefer commands that work in PowerShell.

Standard commands:

```powershell
npm install
npm run dev
npm run dev:3010
npm test
npm run typecheck
npm run lint
npm run build
```

Default local URL:

```text
http://localhost:3000
```

Fallback development URL:

```text
http://localhost:3010
```

Do not assume Unix-only shell utilities are available. If a Bash-only command is genuinely useful, label it clearly and provide a PowerShell-compatible alternative when practical.

## 20. Quality Gates

Before declaring a code change complete, run the checks appropriate to the task.

For normal feature work, aim to run:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

At minimum, run targeted validation plus `typecheck` and `lint` for meaningful code changes.

For production-sensitive work, also verify:

- `/api/health`
- affected authentication flows
- affected RLS policies
- affected provider callbacks/webhooks
- affected map/API behavior
- mobile/responsive UI where relevant

Do not claim a test or build passed unless it actually ran successfully.

If a check cannot run because credentials or an external provider are unavailable, say exactly what was and was not verified.

## 21. Git and Change Safety

Before editing:

```powershell
git status --short
```

After editing:

```powershell
git diff --check
git diff
```

Never:

- run destructive resets without explicit instruction,
- discard unrelated modifications,
- rewrite user work to make the tree cleaner,
- commit secrets,
- change provider credentials,
- create commits, tags, releases, or deployments unless asked.

Keep diffs focused.

## 22. Completion Report

When finishing a task, report:

### Changed
A concise description of the implemented behavior.

### Files
The important files modified or added.

### Verified
Commands/tests/browser flows that actually passed.

### Not verified
Anything requiring credentials, production data, provider approval, or manual testing that could not be verified.

### Risks / follow-up
Only meaningful remaining issues or configuration requirements.

Do not pad completion reports with generic advice.

## 23. Decision Priorities

When two implementations are possible, prefer the option that best preserves this order:

1. user privacy and data isolation,
2. truthful/evidence-backed output,
3. deterministic core behavior,
4. provider terms and security,
5. correctness,
6. maintainability,
7. graceful degradation,
8. performance and cost control,
9. UI polish,
10. implementation convenience.

If convenience conflicts with one of the earlier priorities, convenience loses.
