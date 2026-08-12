# Expedition OS

Expedition OS is a personal adventure-planning application that compares a proposed cycling or bikepacking route with the rider's real activity history.

The product plan is in [docs/EXPEDITION_OS_PLAN.md](docs/EXPEDITION_OS_PLAN.md).

## Current build

The first working slice includes:

- A responsive Next.js and Tailwind dashboard using the Expedition OS palette.
- Server-side parsing of `The Summit Leg Breaker.gpx`.
- Real route distance, ascent, descent, elevation, grade and duration metrics.
- An interactive MapLibre route map with 2D and 3D terrain modes.
- Switchable Default, Topographic, Terrain, Satellite and Global/globe views. OpenTopoMap is the immediate contour-map fallback; Google Roadmap, Terrain and Satellite activate through Map Tiles API when that service is enabled for the configured Cloud project.
- A linked elevation profile for inspecting points along the route.
- Private server-side OpenAI configuration through `.env.local`.
- Live structured OpenAI route analysis with feasibility, risks, preparation steps and explicit assumptions.
- A route-aware Copilot prompt that never exposes the API key to the browser.
- Manual route creation through map clicks and explicit place search.
- GPT-5.6 Luna adventure creation for multi-day bikepacking prompts.
- Real bicycle routing through Valhalla with Open-Meteo elevation enrichment.
- A map-wide OpenStreetMap discovery layer that loads before a route exists, with clusters and toggles for food, fuel, shops, lodging, services, water and highlights.
- A two-stage place loader: 20 popular Google places can appear in roughly the first response on Google basemaps, while the broader community OpenStreetMap layer continues loading and is merged without duplicate markers.
- Place detail cards with mapped opening hours, contact details, official websites, property classifications and safe accommodation-search links when available.
- On-demand Google Places verification for selected named places, including current open status, weekly hours, user rating counts, phone, website and Google Maps links.
- Editable route anchors, cycling preferences and colour-coded day-stage previews.
- Route-aware OpenStreetMap lodging, food, fuel, grocery and service discovery.
- Passwordless Supabase accounts with first name, last name, email, contact number and a saved OTP preference.
- A private profile for address, travel documents, medical aid, allergies, blood type, doctor and emergency contacts.
- Per-user cloud route libraries with automatic import of existing browser-local routes.
- Trip collaboration with owner, editor and viewer roles, in-app invitations and member removal.
- Explicit per-trip emergency-profile sharing; contact details and travel documents remain owner-only.
- Row-level security on every exposed table, validated with a rolled-back two-user isolation test.

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

## Account and OTP setup

ExpeditionOS uses the Supabase publishable key in the browser. The secret key is never included in client bundles. Add the local and production application URLs to the Supabase Auth redirect allow-list.

Email is the canonical identity. The app works with Supabase's default secure sign-in link and also accepts a six-digit email code when the project's email template contains `{{ .Token }}`. New Supabase Free projects require custom SMTP before auth email templates can be customized.

SMS preference is captured at signup, but SMS delivery stays disabled until an SMS provider is configured in Supabase Auth. After that configuration is complete, set `SUPABASE_PHONE_OTP_ENABLED=true` and add the phone-verification step before offering phone sign-in.

SA ID, passport, medical and emergency fields are optional. They should not be collected in production until a privacy policy, retention/deletion process and POPIA information-impact assessment have been completed.

## Private provider configuration

Copy `.env.example` to `.env.local` and keep real credentials only in `.env.local`. `GOOGLE_API_KEY` is used exclusively by server route handlers and is never returned to the browser. Restrict the Google key to the specific server-side APIs ExpeditionOS uses and configure billing budgets and quota alerts before deployment.
