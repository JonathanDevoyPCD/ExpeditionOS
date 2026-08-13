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

### Next Phase A increments

- Strava webhook handling for activity create, update, delete and deauthorization.
- Terrain and bicycle-type relevance.
- Optional heart-rate and power drift after activity streams are imported.
- A deterministic evidence packet for the Expedition Copilot.

## Phase B: trip logistics and gear

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
