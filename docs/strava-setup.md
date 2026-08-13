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
```

Generate the encryption key once:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Keep the encryption key stable and backed up with the deployment secrets. Replacing it without first re-encrypting stored tokens will make existing Strava connections unreadable.

Redeploy Vercel after adding or changing environment variables.

## 3. Permissions and imported data

ExpeditionOS requests `read` and `activity:read_all`. The latter is needed to include private activities in a complete personal readiness history. A rider can refuse the permission, but ExpeditionOS will not create an incomplete connection while presenting it as complete.

The initial sync reads up to the latest year of activities in at most five 200-item pages, keeps cycling activity types, and stores compact summaries rather than full streams. The app records Strava's read-rate-limit headers and refreshes access tokens when they have one hour or less remaining. Every returned refresh token replaces the previous one.

## 4. Current limits and next increment

New Strava applications begin in single-player mode. This supports the primary rider; additional riders require increased athlete capacity through Strava's API settings and, at larger scale, Strava review.

Manual sync is implemented first to keep API use predictable. The next increment should register Strava webhooks for activity create, update, delete and athlete deauthorization events so routine polling is unnecessary.

Official references:

- [Strava authentication](https://developers.strava.com/docs/authentication/)
- [Strava API reference](https://developers.strava.com/docs/reference/)
- [Strava rate limits](https://developers.strava.com/docs/rate-limits/)
- [Strava webhooks](https://developers.strava.com/docs/webhooks/)
