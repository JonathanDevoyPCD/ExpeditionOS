# ExpeditionOS Later Builds

This file records features that cannot be completed responsibly with the currently configured services. Features that can be built locally or with the existing OpenAI and OpenStreetMap integrations should be implemented now instead of being deferred here.

## Already available without a paid places API

ExpeditionOS now loads places across the visible map before a route exists, using OpenStreetMap and Overpass. Every supported category is on initially and can be toggled independently. The current layer includes food, fuel, groceries, shops, drinking water, bike repair, pharmacies, toilets, lodging and outdoor/cultural highlights. Where contributors have supplied them, detail cards show addresses, listed opening hours, phone numbers, websites and lodging star classifications. Lodging cards can open a Booking.com destination search, but this is deliberately not presented as live pricing or availability.

OpenStreetMap is community-maintained rather than a real-time business directory. Listed hours and contact details must therefore be confirmed directly, especially before a remote trip.

## Geoapify enrichment

**Optional next step:** Add a private `GEOAPIFY_API_KEY` after deciding whether its free allowance and attribution terms fit production use.

Geoapify currently offers a free daily allowance and can enrich selected OpenStreetMap places with normalized address, contact, facility and opening-hours data. It is a good first optional provider because it can improve details without making the core map dependent on a paid service. It does not replace Google-style user ratings, reviews or live booking inventory.

## Google Places enrichment

**Implemented now:** Named OpenStreetMap places are matched on demand through Places API (New) when the rider selects them. A visually separate Google Maps panel can show the matched business name, current open status, weekly hours, rating and rating count, type, price level, phone, website and Google Maps link. The API key stays server-side, lookups are rate-limited, results are not persisted, and Google data is clearly attributed.

OpenStreetMap remains the broad no-cost discovery layer. Google is deliberately not queried for every visible marker or every map movement because that would create unnecessary Enterprise SKU calls and make browsing costs difficult to predict.

Before production launch:

- restrict the server key by API and production server IP where practical;
- configure billing budgets, quota alerts and per-minute limits;
- publish Terms of Use and a Privacy Policy incorporating Google's required terms;
- keep Google content visually separate and correctly attributed;
- review the current Google Maps Platform storage and caching rules before adding persistence;
- use a separate browser-restricted key if Maps JavaScript or Places UI Kit is later added.

Google-only businesses are not yet added as markers to the MapLibre map. Google's policies require Google Places results plotted on a map to be displayed on a Google map. If we want a full Google Places marker layer, the clean implementation is a selectable Google Maps/Places UI Kit map mode rather than mixing Google markers into the OpenStreetMap canvas.

## Other enabled Google APIs worth using later

- **Routes API:** Compare Google bicycle routes with Valhalla candidates and offer shorter-distance alternatives. Google route geometry must follow its display and attribution policies.
- **Geocoding API:** Improve explicit address and business search where Nominatim is ambiguous.
- **Maps Elevation API:** Provide an optional second elevation source for route-profile comparison and anomaly detection.
- **Weather, Air Quality and Pollen APIs:** Add date-aware environmental panels once trip dates and forecast confidence rules are implemented.
- **Map Tiles API / photorealistic 3D:** The 2D Roadmap, Terrain and Satellite session/proxy integration is implemented, but Google's live endpoint currently reports that Map Tiles API is disabled or has not propagated for the configured Cloud project. Once enabled, these layers activate automatically after an app refresh. Photorealistic 3D remains a later renderer and cost decision.
- **Time Zone API:** Convert opening hours, sunrise and itinerary times correctly for routes crossing time zones.

The legacy Directions and Distance Matrix APIs are not priorities because Routes API is their modern replacement. Mobile SDKs, Navigation SDKs, Solar, Roads and Route Optimization do not currently solve the core bikepacking-planning problem.

## Topographic source roadmap

The current Topographic layer uses OpenTopoMap, a worldwide contour and relief map built from OpenStreetMap and elevation data. It is a stronger expedition-planning fallback than the standard street tiles, but it is not an official South African survey sheet.

South Africa's CD:NGI produces the official 1:50 000 national topographic series with 20 metre contours. Before adding those sheets as an in-app layer, confirm a stable WMTS/WMS or raster-tile endpoint, licensing, update metadata and reprojection strategy through the CD:NGI Geoportal. Until then, do not silently label a generic global contour layer as the official South African topographic map.

## Place loading performance

The planner now separates place loading into two stages. On an active Google basemap, Nearby Search returns up to 20 popular places first and the slower OpenStreetMap/Overpass coverage is merged in afterward. Google markers are only plotted on Google basemaps to respect Google Maps Platform display policies. The Overpass request uses an expanded, quantized viewport cache so small pans reuse results rather than starting another full-area query.

Public Overpass remains inherently variable and is unsuitable as the only production discovery backend. The production solution remains managed/self-hosted Overpass or a licensed indexed provider for the complete community layer.

## Live accommodation prices and booking availability

**Blocked by:** Commercial accommodation partner APIs, affiliate approval, rate limits, and booking terms.

Static lodging locations can be shown now through OpenStreetMap. Live room prices, vacancy, cancellation rules, and booking require an approved provider such as Booking.com, Expedia, LekkeSlaap, or direct property integrations.

Booking.com Demand API access requires affiliate approval and credentials. Until then, ExpeditionOS may open a normal destination search page, but it must not claim that a room, price or review score is current.

The future Stays workspace should accept arrival/departure dates, traveller and room counts, accommodation types and a search area. It should compare total and per-person prices for backpackers/hostels, guest houses, B&Bs, self-catering and camping, then let the planner attach the selected stay to a trip stage. Live availability and pricing remain blocked on provider approval; manually saved candidates and outbound provider searches can be built first.

The future Funds workspace should track estimated and actual trip costs for stays, food, groceries, transport, fuel, permits, repairs, activities and an emergency buffer. It should calculate trip/day/person totals, assign payers and participants, share budgets with trip members and reconcile paid versus owed amounts. The first version is budgeting and cost sharing only; receiving or transferring money requires a separate payment-provider and regulatory decision.

## Strava account synchronization

**Foundation implemented:** ExpeditionOS now has server-side OAuth initiation and callback routes, encrypted token storage, automatic short-lived token refresh, one-year cycling-summary backfill, manual synchronization, rate-limit tracking, safe revocation, owner-only activity access and a Readiness workspace.

**Activation still requires:** A registered Strava application plus `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` and `STRAVA_TOKEN_ENCRYPTION_KEY` in local and Vercel environments. The production authorization callback domain must be `expedition-os-mocha.vercel.app`.

The next Strava increment is webhook-driven create, update, delete and deauthorization handling, followed by deterministic route-versus-history readiness scoring. New applications begin in single-player mode; expanded athlete capacity requires configuration or review through Strava.

## Account services still to add

**Core Supabase integration is implemented:** Passwordless email access, per-user profiles and routes, owner/editor/viewer trip membership, invitations and opt-in emergency sharing now use versioned migrations and row-level security. The secret key remains server-only. A live rolled-back two-user test confirms that route membership never exposes contact information or travel documents, and that emergency data remains hidden until the user opts in for that trip.

Still required before a public production launch:

- configure custom SMTP and a branded email template if six-digit email codes are preferred over Supabase's default secure sign-in link;
- configure a supported SMS provider and phone verification before enabling contact-number OTP;
- send transactional invitation emails through a server-side Edge Function or email provider; invitations currently appear inside ExpeditionOS when the invited email signs in;
- complete a formal retention policy, legal review, audit logging and a POPIA information-impact assessment before relying on the travel-document or medical fields. Privacy and Terms pages, JSON account export and authenticated self-service deletion are implemented in the alpha;
- add application-level encryption or a dedicated secrets workflow if the product later needs stronger protection than platform encryption plus RLS for ID, passport and medical-aid numbers;
- test the complete sign-up and invitation flows with two real email accounts after production Auth redirect URLs and SMTP are configured.

## Hosted deployment

**Use Vercel or another Next.js server host, not GitHub Pages.** ExpeditionOS has dynamic server routes for OpenAI, Google Places, map tiles, geocoding and route building, which cannot run on static GitHub Pages. A public GitHub repository can still remain the source of truth while Vercel deploys it to an `expeditionos` subdomain or custom `.io` domain. Add that exact URL to the Supabase Auth redirect allow-list.

**Alpha status:** The production Vercel project is `expedition-os`, connected to `JonathanDevoyPCD/ExpeditionOS`, with the canonical alpha URL `https://expedition-os-mocha.vercel.app`. Keep that exact origin in Supabase Auth and as `SITE_URL`. Custom SMTP remains necessary for users outside the Supabase project team.

## Hosted offline maps

**Blocked by:** A selected regional tile dataset, storage budget, tile hosting, update process, and map-data licensing review.

Offline GPX and itinerary export work without this. Fully offline interactive terrain and place maps require downloadable vector tiles and elevation data for the chosen expedition region.

## Production routing and geocoding infrastructure

**Blocked by:** A hosting/provider decision, expected request volume, regional coverage targets, and an operations budget.

Manual and Copilot route creation currently use the public Valhalla and Nominatim services at conservative development volume, with server-side caching and explicit searches. Before public launch, deploy managed or self-hosted Valhalla and Nominatim instances (or select commercial equivalents) so ExpeditionOS does not depend on community demo capacity. Open-Meteo currently supplies sampled route elevation and must retain its attribution.
