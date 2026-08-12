import LegalPage from "@/components/legal/LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Your expedition data should remain yours."
      summary="This notice explains what the ExpeditionOS alpha stores, why it is used, and the controls available to you. It is a practical alpha policy and should receive legal review before a broad commercial launch."
    >
      <section><h2>Information we store</h2><p>Account details include your name, email address, contact number and OTP preference. Optional profile fields can include home location, identity or passport details, date of birth, medical aid information, blood type, allergies, doctor details and emergency contacts. We also store routes, trip membership, invitations and planning inputs you choose to create.</p></section>
      <section><h2>How it is used</h2><p>We use this information to authenticate you, save your private route library, support trip collaboration, personalize planning and provide the safety information features you choose to use. Sensitive profile fields are owner-only by default and are not exposed to other trip members through the current alpha.</p></section>
      <section><h2>Service providers</h2><p>ExpeditionOS uses Supabase for authentication and database storage, Vercel for application hosting, OpenAI for Copilot features, and map or place-data providers such as Google and OpenStreetMap-based services. A request sent to Copilot or a mapping provider may include the route, location or prompt needed to answer it. Do not place identity, passport or medical numbers in a Copilot prompt.</p></section>
      <section><h2>Sharing and retention</h2><p>Routes can be shared with people you invite as viewers or editors. We retain account information while your account exists, subject to operational backups and legal obligations. You can download a machine-readable account copy or permanently delete your account from Profile &amp; emergency information.</p></section>
      <section><h2>Your choices</h2><ul><li>Leave optional identity, travel and medical fields blank.</li><li>Edit your stored profile information at any time.</li><li>Export your account and route data as JSON.</li><li>Delete your account and associated data.</li></ul></section>
      <section><h2>Security and contact</h2><p>We use access controls and row-level database policies to separate user data, but no online service can guarantee absolute security. During the private alpha, privacy or deletion issues should be reported directly to the ExpeditionOS project administrator who invited you.</p></section>
    </LegalPage>
  );
}
