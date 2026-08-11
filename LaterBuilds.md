# ExpeditionOS Later Builds

This file records features that cannot be completed responsibly with the currently configured services. Features that can be built locally or with the existing OpenAI and OpenStreetMap integrations should be implemented now instead of being deferred here.

## Google Places enrichment

**Blocked by:** A separate Google Maps Platform account, Places API key, enabled billing, usage limits, and a product decision about ongoing API spend.

Use Google Places as an optional enrichment layer over OpenStreetMap results for:

- recently verified business status and opening hours;
- ratings, reviews, photos, and richer place categories;
- phone numbers and official website details where available;
- improved search-along-route coverage for businesses not mapped in OpenStreetMap.

The OpenStreetMap provider must remain available as the no-cost baseline. Google results should be cached and requested only when useful.

## Live accommodation prices and booking availability

**Blocked by:** Commercial accommodation partner APIs, affiliate approval, rate limits, and booking terms.

Static lodging locations can be shown now through OpenStreetMap. Live room prices, vacancy, cancellation rules, and booking require an approved provider such as Booking.com, Expedia, LekkeSlaap, or direct property integrations.

## Strava account synchronization

**Blocked by:** A registered Strava application, OAuth client credentials, redirect configuration, and user authorization.

Once configured, ExpeditionOS can compare planned routes with recent training load and personalize feasibility advice. The application must store tokens privately and respect Strava API limits and display requirements.

## Hosted offline maps

**Blocked by:** A selected regional tile dataset, storage budget, tile hosting, update process, and map-data licensing review.

Offline GPX and itinerary export work without this. Fully offline interactive terrain and place maps require downloadable vector tiles and elevation data for the chosen expedition region.

## Production routing and geocoding infrastructure

**Blocked by:** A hosting/provider decision, expected request volume, regional coverage targets, and an operations budget.

Manual and Copilot route creation currently use the public Valhalla and Nominatim services at conservative development volume, with server-side caching and explicit searches. Before public launch, deploy managed or self-hosted Valhalla and Nominatim instances (or select commercial equivalents) so ExpeditionOS does not depend on community demo capacity. Open-Meteo currently supplies sampled route elevation and must retain its attribution.
