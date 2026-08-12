import LegalPage from "@/components/legal/LegalPage";

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms of use"
      title="Plan boldly. Verify before you go."
      summary="These alpha terms set the practical boundary between planning assistance and decisions that must still be made by the rider or trip organizer. They should receive legal review before a broad commercial launch."
    >
      <section><h2>Alpha service</h2><p>ExpeditionOS is an early-stage route and expedition planning tool. Features, data sources and availability may change. You must provide accurate account information, safeguard access to your email or phone, and use the service lawfully.</p></section>
      <section><h2>Planning is not a safety guarantee</h2><p>Routes, elevation, weather, opening hours, prices, availability, road surfaces, access restrictions and AI suggestions can be incomplete or outdated. Confirm critical information with official or local sources before departure. You remain responsible for route choice, permissions, equipment, fitness, navigation, bookings, emergency planning and decisions in the field.</p></section>
      <section><h2>Copilot and third-party data</h2><p>AI-generated plans may contain errors. Map, place, lodging and booking information comes from third parties and does not constitute an endorsement or confirmed reservation. Booking links and prices must be verified with the provider.</p></section>
      <section><h2>Shared trips</h2><p>Trip owners may invite viewers or editors. Only share routes and trip information with people you trust. Editors may be able to change shared planning data, while the trip owner remains responsible for coordinating the final plan.</p></section>
      <section><h2>Acceptable use</h2><p>Do not use ExpeditionOS to violate access rules, trespass, harass others, upload unlawful content, probe security controls or interfere with the service. We may restrict alpha access to protect users, data or infrastructure.</p></section>
      <section><h2>Your content and account</h2><p>You retain responsibility for content you add. You grant the service the limited permission needed to store, process and display it for the features you request. You can export your data and delete your account from your profile controls.</p></section>
      <section><h2>Availability and liability</h2><p>The alpha is provided as available without a promise of uninterrupted operation. To the extent permitted by law, ExpeditionOS is not responsible for losses caused by reliance on unverified route, AI, place or booking information. Nothing here removes rights that cannot legally be excluded.</p></section>
    </LegalPage>
  );
}
