# ExpeditionOS Specialist Skill Strategy

Specialist skills should be added only when they provide a reusable workflow or protect a high-risk product boundary. The main `expeditionos-developer` skill remains the default owner of ordinary feature and debugging work.

## Active skills

| Skill | Decision | Purpose |
|---|---|---|
| `expeditionos-ui-director` | Use now | Map-led hierarchy, responsive composition, visual audits, implementation and refinement. A streamlined copy is versioned in `.agents/skills/` and installed privately for Codex. |
| `expeditionos-browser-verify` | Use now | Observable desktop/tablet/mobile QA, console/network inspection and authenticated journey verification when a session is available. |
| `supabase-rls-guardian` | Use now for schema/security work | Protects owner, contributor, viewer, pending invitee, non-member and anonymous boundaries. It should not activate for ordinary client-only UI changes. |
| `expeditionos-test-data` | Use now when fixtures are needed | Generates deterministic, privacy-safe route/logistics fixtures without copying real profile, Strava or booking data. |
| `expeditionos-release-check` | Use for every release | Enforces explicit staging, tests, secret checks, GitHub/Vercel verification and production health checks. |

## Recommended specialists to build when their domain is next modified

These are valuable, but creating them before a real task would duplicate the main project skill without giving us evidence that their workflow is correct.

| Skill | Build trigger | What it should uniquely own |
|---|---|---|
| `expeditionos-route-lab` | Next meaningful GPX/routing/elevation change | Known GPX fixtures, tolerances, continuity checks, stage splitting and regression comparison of deterministic route facts. |
| `expeditionos-map-debugger` | Next difficult map/cluster/terrain interaction bug | Real rendered MapLibre evidence, layers/sources lifecycle, cluster expansion, camera/viewport behavior and provider-safe basemap diagnosis. |
| `provider-integration-guardian` | Next new or materially changed external provider | Quotas, caching, attribution, licensing/storage restrictions, cost boundaries, credentials and honest fallback behavior. |
| `strava-integration-debugger` | Athlete expansion, OAuth/webhook incident or new Strava evidence | Token rotation, webhook lifecycle, rate limits, backfills, deauthorization and privacy-safe stream processing. |
| `readiness-engine-auditor` | Next readiness scoring/rule version | Golden rider/route fixtures, factor traceability, confidence behavior and detection of hidden weak factors or unintended score drift. |
| `expeditionos-ai-guardian` | Next Copilot schema/prompt/evidence expansion | Structured Outputs, minimized evidence packets, hallucination tests, privacy review and model/token-cost discipline. |
| `expeditionos-privacy-auditor` | Before broader public use or new sensitive sharing | End-to-end tracing of identity, medical, emergency, booking and Strava data through RLS, APIs, UI payloads, logs and AI requests. |

## Defer as a capability rather than a separate skill

| Suggestion | Decision | Reason |
|---|---|---|
| `expeditionos-e2e-tests` | Defer until a stable automated OTP/test-account strategy exists | This should become an actual maintained E2E test suite using browser verification and safe fixtures, not only a prompt skill. |
| `expeditionos-performance` | Use the existing benchmark/profiling workflow when measurements show a problem | A product-specific skill is premature until we have repeatable route, POI and map performance baselines. |

## Do not create separately

| Suggestion | Use instead | Reason |
|---|---|---|
| `expeditionos-database-migrator` | `supabase-rls-guardian` plus the project developer skill | Schema evolution, policies, indexes and compatibility are one security workflow; splitting them would create conflicting ownership. |
| `expeditionos-api-debugger` | Project developer debug workflow plus the general investigation workflow | The existing process already traces validation, auth, database/provider calls and responses end to end. |
| `expeditionos-bug-hunter` | Project developer debug workflow plus browser verification | Reproduction-first diagnosis is already a core rule and does not need another broad catch-all skill. |
| `expeditionos-feature-builder` | `expeditionos-developer` | The project skill already owns vertical-slice discovery, permissions, deterministic logic, UI, tests and verification. |

## Operating rule

Create a deferred specialist only when a concrete task enters that domain. Build it from the real execution path, failure modes, fixtures and verification evidence found during that work; then keep only guidance that materially improves future decisions.
