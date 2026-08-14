# Strava connection setup

ExpeditionOS uses Strava's OAuth 2.0 API directly. Strava tokens are handled only by Next.js server routes, encrypted with AES-256-GCM before database storage, and never returned to browser JavaScript.

## 1. Register the application

Create an API application at `https://www.strava.com/settings/api`.

For the hosted alpha use:

- Website: `https://expedition-os-mocha.vercel.app`
- Authorization Callback Domain: `expedition-os-mocha.vercel.app`
- Callback URL used by ExpeditionOS: `https://expedition-os-mocha.vercel.app/api/strava/callback`

Strava validates the callback domain configured in its application settings. Local OAuth testing may require temporarily changing that domain or using an approved development hostname.

## 2. Configure secrets

Add these values to `.env.local` and to the Vercel Production, Preview and Development environments:

```text
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_TOKEN_ENCRYPTION_KEY=
STRAVA_WEBHOOK_VERIFY_TOKEN=
STRAVA_WEBHOOK_SUBSCRIPTION_ID=
```

Generate the encryption key once:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Keep the encryption key stable and backed up with the deployment secrets. Replacing it without first re-encrypting stored tokens will make existing Strava connections unreadable.

Generate a separate webhook verification token and keep it server-only:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Redeploy Vercel after adding or changing environment variables.

## 3. Permissions and imported data

ExpeditionOS requests `read` and `activity:read_all`. The latter is needed to include private activities in a complete personal readiness history. A rider can refuse the permission, but ExpeditionOS will not create an incomplete connection while presenting it as complete.

The initial sync reads up to the latest year of activities in at most five 200-item pages, keeps cycling activity types, and stores compact summaries. It may inspect up to six recent sensor-equipped rides for heart-rate and power drift while preserving headroom under Strava's reported rate limits. Only derived sample counts, heart-rate drift, power fade and aerobic decoupling are stored; raw streams are discarded immediately. The app refreshes access tokens when they have one hour or less remaining, and every returned refresh token replaces the previous one.

## 4. Current limits and next increment

New Strava applications begin in single-player mode. This supports the primary rider; additional riders require increased athlete capacity through Strava's API settings and, at larger scale, Strava review.

## Register the webhook

Add `STRAVA_WEBHOOK_VERIFY_TOKEN` locally and to Vercel, redeploy so the public verification endpoint is active, then run:

```powershell
npm run strava:webhook -- register
```

The command uses `SITE_URL` to register `${SITE_URL}/api/strava/webhook`. Strava allows only one subscription per application. If another callback is already registered, inspect it with `npm run strava:webhook -- list` and remove it only when you intend to replace it with `npm run strava:webhook -- delete <subscription-id>`.

After registration, copy the returned value into `STRAVA_WEBHOOK_SUBSCRIPTION_ID` locally and in Vercel, then redeploy once more. ExpeditionOS rejects POST events from any other subscription ID.

Activity create and update events fetch the current Strava activity and upsert only recognized cycling activity types. Delete events remove the matching private summary. Athlete deauthorization removes the connection and all imported activity summaries. Webhook work runs after the `200` acknowledgement so Strava receives its required prompt response; failures are recorded on the connection and remain recoverable through manual sync.

## Readiness privacy boundary

Readiness v3 compares route stages with private activity summaries, adds sport-type relevance for the saved bicycle setup, and presents optional physiology drift separately from the deterministic score. The Copilot evidence packet excludes athlete identity, activity names and identifiers, route coordinates and raw streams. It is planning evidence, not a medical assessment.

Official references:

- [Strava authentication](https://developers.strava.com/docs/authentication/)
- [Strava API reference](https://developers.strava.com/docs/reference/)
- [Strava rate limits](https://developers.strava.com/docs/rate-limits/)
- [Strava webhooks](https://developers.strava.com/docs/webhooks/)
