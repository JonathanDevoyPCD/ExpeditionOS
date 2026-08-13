# Supabase six-digit email OTP setup

ExpeditionOS verifies email access with the six-digit code entered in the app. Supabase decides whether `signInWithOtp()` sends a magic link or a code from the authentication email template:

- `{{ .ConfirmationURL }}` sends a magic link.
- `{{ .Token }}` sends a six-digit OTP.

## Hosted project setup

The ExpeditionOS Supabase project is on the Free plan and was created after 3 June 2026. Supabase therefore requires custom SMTP before authentication email templates can be changed.

1. In Supabase, open **Project Settings > Authentication > SMTP Settings**.
2. Enable custom SMTP and enter the selected provider's host, port, username, password, sender email, and sender name.
3. Open **Authentication > Email Templates**.
4. Select **Magic Link** and set its subject to:

   ```text
   {{ .Token }} is your ExpeditionOS sign-in code
   ```

5. Replace its body with the contents of `supabase/templates/email-otp.html`.
6. Select **Confirm signup** and set its subject to:

   ```text
   {{ .Token }} is your ExpeditionOS verification code
   ```

7. Replace its body with the same template.
8. Save both templates, request a fresh code from ExpeditionOS, and enter it once in the app.

Do not include `{{ .ConfirmationURL }}` in either template. A code is single-use and should never be shared.
