# ExpeditionOS readiness and logistics roadmap

Status: approved for implementation on 13 August 2026.

## Decision

Build the next two product phases in this order:

1. Route-specific readiness using the rider's private Strava history.
2. Integrated trip logistics covering stages, stays, resupply, reservations and collaborative gear.

Expanded Google review content and Booking.com Demand API integration remain a later provider phase. Existing Google place details and Booking.com destination links stay available in the meantime.

## Product outcome

ExpeditionOS should answer two connected questions:

1. Does the rider's demonstrated history support this route and daily workload?
2. Can the route be turned into a practical trip with viable overnight stops, resupply, equipment and shared responsibilities?

The product is not a generic hotel browser. Route boundaries, rider capability and logistical constraints should influence one another.

## Phase A: route readiness

### First vertical slice

- Select any accessible saved route from the Readiness workspace.
- Derive day stages from saved overnight anchors, falling back to Copilot distance targets or an explicit equal split.
- Compare the hardest stage distances, climbing loads and moving times with the signed-in rider's latest year of cycling summaries.
- Calculate deterministic distance, climbing, duration, recent-volume, recency and consecutive-day factors.
- Return a versioned score, confidence, largest gap, comparable completed rides and explicit unknowns.
- Keep Strava history and scores private to the rider, including on shared trips.
- Show deterministic output even when OpenAI is unavailable.

### Readiness screen

```text
+---------------------------------------------------------------+
| Readiness for Jonathan                         [Sync Strava]    |
+---------------------------------------------------------------+
| Imported rides | 90-day load | Longest ride | Biggest climb   |
+---------------------------------------------------------------+
| Route to assess [The Summit Leg Breaker - 1 day             v] |
+----------------------+----------------------------------------+
|  READINESS 78/100    | Hardest stage: day 2 - 105 km / 1,117 m |
|  Viable with prep    |                                        |
+----------------------+----------------------------------------+
| Distance  | Climbing | Duration | Volume | Recency | Back-back |
+---------------------------------------------------------------+
| Closest completed rides       | Limits and unknowns            |
+---------------------------------------------------------------+
```

### Completed Phase A increments

- Terrain and bicycle-type relevance uses the saved Road, Hybrid or Mountain setup and matching Strava sport history. Unverified surface remains explicit rather than inferred from the map.
- Optional heart-rate, power-fade and aerobic-decoupling summaries are derived from a small rate-conscious set of recent activity streams. Raw stream samples are never persisted and physiology remains explanatory rather than medical or automatically score-changing evidence.
- A deterministic `copilot-readiness-evidence-v1` packet includes compact route load, readiness factors, anonymised comparable efforts, physiology summaries and explicit unknowns without identity, route traces or raw activity streams.

### Completed Phase A reliability

- Strava webhook verification and subscription tooling.
- Immediate acknowledgement with post-response processing for activity create, update and delete events.
- Automatic removal of encrypted connection data and imported history after Strava deauthorization.
- Rate-limit-aware stream enrichment that stops before Strava's short-term or daily read allowance is exhausted.
- Versioned `readiness-v3` rules with deterministic terrain relevance, stage-aware scoring and private Copilot evidence.

## Phase B: trip logistics and gear

### Navigation and information architecture

Use the application navigation consistently rather than turning every Phase B feature into a dashboard tab.

**Sidebar workspaces**

- **Stays:** accommodation discovery, comparison, selected overnight stays, reservations and booking references.
- **Gear:** personal and shared packing lists, assignments, packed status and missing-item warnings.
- **Funds:** trip budgets, estimated and actual costs, payer assignments and balances. Funds remains a dedicated workspace because it spans accommodation, food, transport and gear rather than belonging to one dashboard panel.

**Dashboard tabs**

- **Route Intelligence:** route load, stages, resupply gaps, readiness signals and route-specific risks.
- **Accommodation:** a compact trip summary showing overnight coverage, selected and backup stays, reservation status and accommodation cost totals. Detailed work opens in the Stays sidebar workspace.
- **Weather:** route-aware current conditions, hourly and daily forecasts, animated map overlays and weather risks. Detailed weather remains in the trip dashboard because it changes the viability and timing of the active route.

The dashboard is the command centre for the selected trip. Sidebar workspaces are where the user performs deeper cross-trip planning and management.

### Weather intelligence

#### Forecast data decision

- Use the [Google Maps Platform Weather API](https://developers.google.com/maps/documentation/weather/) as the primary production source. It is already enabled for ExpeditionOS, covers South Africa for current, hourly and daily data, refreshes frequently, and provides up to 240 hourly forecast hours and 10 daily forecast days.
- Fetch weather through a server route so the Google key remains private. Cache by rounded coordinate, forecast type and provider update window to avoid repeat billable requests.
- Use [Open-Meteo](https://open-meteo.com/en/docs) during development as a fallback and, where useful, as an explicit model-comparison source. Do not silently merge two providers into a single forecast. Show the provider, model where available, model/update time and data age.
- Google does not currently provide public weather alerts for South Africa. ExpeditionOS must therefore derive clearly labelled planning warnings from forecast values and must not present them as official government alerts.

#### Route-aware sampling

- Sample the route start and finish, every overnight stage end, major high points and exposed segments, plus evenly spaced points on long stages.
- Prefer the forecast nearest the rider's expected arrival time at each sample rather than applying one town forecast to the entire route.
- Calculate cycling-specific effects including projected headwind, tailwind and crosswind from route bearing; gust exposure; heat and cold stress; rain windows; thunderstorm probability; visibility; and available daylight.
- Keep the forecast date-aware. For trips beyond the provider forecast horizon, show seasonal planning context separately and label it as non-forecast guidance.
- Every weather card must show when it was updated and degrade visibly when data is stale or unavailable.

#### Weather tab

- Current conditions for the active route or selected stage.
- A scrollable 48-hour detailed timeline and the provider's complete hourly horizon on demand.
- A 10-day daily summary with minimum/maximum temperature, precipitation, wind/gust, sunrise and sunset.
- Stage cards that show likely conditions at planned departure, exposed/high points and arrival.
- A time slider with map toggles for wind, gusts, rain/precipitation, temperature, cloud and pressure where the selected visual provider supports them.
- Explicit route warnings and suggested timing changes. Forecasts remain planning guidance, not a safety guarantee.

#### Wind and rain map decision

- Earth Nullschool is an excellent reference visualization, but it does not expose a documented supported application API. Do not scrape its private data paths or make the product dependent on an iframe.
- Add an **Open in Earth** action that deep-links to the selected route area for an optional global wind view, with clear external attribution.
- For the first in-app visual layer, use forecast raster tiles that can sit above the existing MapLibre map. OpenWeather Weather Maps 2.0 is the preferred technical fit because it exposes wind, precipitation, temperature, cloud and pressure tiles with forecast timestamps. It requires a separate subscription/API key and a licensing check before production use.
- Keep Windy Map Forecast API as the premium Earth-style option. It offers animated particles, multiple forecast models and many layers, but its production licence is materially more expensive and it uses its own map integration.
- RainViewer may be used only as an optional recent-radar layer where coverage exists. Its free API no longer supplies future nowcast frames and has no SLA, so it cannot be the projected-rain source or the sole rain layer.
- A custom particle renderer driven by raw GFS/ECMWF grids is possible later, but it is a separate data-processing and performance project rather than the Phase B minimum.

### Durable shared entities

- Trip stages and adjustable day boundaries.
- Saved places attached to a trip as overnight, food, water, repair or bailout stops.
- Stay candidates with check-in/out dates, price notes, contact details and source links.
- Reservation states: researching, contacted, reserved, paid and confirmed.
- Private booking references and confirmation notes.
- Trip-specific packing lists, templates and item assignments.
- Personal versus shared gear and packed/missing status.

### Stays workspace

- Search around a stage end, selected map area or manually entered destination.
- Require arrival date, departure date, number of adults and number of rooms before requesting live availability.
- Filter by backpackers/hostels, guest houses, bed and breakfasts, self-catering, camping and other practical cycling accommodation.
- Sort by cheapest total stay, cheapest per person, distance from the route, rating or best overall fit.
- Show nightly price, total price, taxes/fees when supplied, cancellation terms and distance from the planned stage end.
- Compare several candidates before selecting an overnight stay.
- Start with manually saved candidates and provider search links; add licensed live inventory during the deferred provider phase.

### Funds workspace

- Maintain an estimated and actual budget for each trip.
- Cover accommodation, food, groceries, transport, fuel, permits, repairs, activities and an emergency buffer.
- Calculate totals per trip, per day and per person in the trip currency, with South African rand as the initial default.
- Share budget lines and cost updates with trip members while retaining owner/contributor/viewer permissions.
- Assign a payer, participants and split method to each cost, then show who has paid and who still owes.
- Let the planner estimate local costs before booking and replace estimates with confirmed amounts later.
- Keep receipts, notes and booking references private to authorised trip members.
- Treat payments and money transfers as a later integration; the first release tracks, shares and reconciles costs without holding funds.

### Logistics screen

```text
+---------------------------+-----------------------------------+
| Day 1 - 82 km / 940 m     | Map: route, stops and day ranges  |
| [Stay] [Water] [Food]     |                                   |
| Overnight: Jeffreys Bay   |   o----water----o----stay         |
+---------------------------+-----------------------------------+
| Reservations              | Gear readiness                    |
| Stay: Reserved            | Shared pump: Jonathan             |
| Dinner: Researching       | First aid: Missing                |
+---------------------------+-----------------------------------+
| Funds: R12,400 estimated  | R3,100 per person · 4 people      |
+---------------------------+-----------------------------------+
```

### Route-aware behaviour

- Warn when a stage ends without a viable overnight location.
- Warn when resupply gaps exceed the rider's configured carrying range.
- Suggest moving a day boundary or changing the route when logistics are weak.
- Let owners and contributors edit shared logistics; viewers remain read-only.

## Deferred provider phase

- Booking.com Search-Look-Redirect integration for dated availability and estimated pricing.
- Provider-backed cheapest-stay comparison using dates, occupancy, accommodation type, total price and per-person price.
- Additional Google review content only where licensing, attribution and cost are justified.
- In-app accommodation checkout only after partner approval and a clear product need.
- Payment collection or trip-wallet functionality only after a separate financial, security and regulatory review.

## Success criteria

- The same route and activity history always produce the same readiness result.
- Weak factors remain visible and cannot be hidden by a high average.
- Sparse history lowers confidence.
- A trip member cannot access another member's private Strava history or readiness report.
- Logistics remain useful with manual data and open map providers when paid providers are unavailable.
