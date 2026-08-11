# Expedition OS

Expedition OS is a personal adventure-planning application that compares a proposed cycling or bikepacking route with the rider's real activity history.

The product plan is in [docs/EXPEDITION_OS_PLAN.md](docs/EXPEDITION_OS_PLAN.md).

## Current build

The first working slice includes:

- A responsive Next.js and Tailwind dashboard using the Expedition OS palette.
- Server-side parsing of `The Summit Leg Breaker.gpx`.
- Real route distance, ascent, descent, elevation, grade and duration metrics.
- An interactive MapLibre route map with 2D and 3D terrain modes.
- A linked elevation profile for inspecting points along the route.
- Private server-side OpenAI configuration through `.env.local`.
- Live structured OpenAI route analysis with feasibility, risks, preparation steps and explicit assumptions.
- A route-aware Copilot prompt that never exposes the API key to the browser.
- Manual route creation through map clicks and explicit place search.
- GPT-5.6 Luna adventure creation for multi-day bikepacking prompts.
- Real bicycle routing through Valhalla with Open-Meteo elevation enrichment.
- Route-aware OpenStreetMap lodging, food, fuel, grocery and service discovery.
- A private browser-local route library that reopens generated routes in the dashboard.

## Run locally

```powershell
npm install
npm run dev
```

Then open `http://localhost:3000`.

If port 3000 is unavailable, use the dedicated alternate-port command:

```powershell
npm run dev:3010
```

Then open `http://localhost:3010`.

Use `npm run typecheck`, `npm run lint`, and `npm run build` before shipping changes.
