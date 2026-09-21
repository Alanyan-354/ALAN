# Supabase Auth setup

RATEDUKE uses Supabase Auth plus database-backed profiles. The hosted project must use the same origin as `NEXT_PUBLIC_SITE_URL`.

## Hosted URL configuration

- Site URL: `http://127.0.0.1:3000`
- Redirect URL: `http://127.0.0.1:3000/auth/callback`
- Development alias: `http://localhost:3000/auth/callback`

Replace these local URLs with the deployed HTTPS origin before production launch, while retaining local URLs only when local sign-in is still needed.

## Custom SMTP is required

Supabase's built-in sender is for initial testing only. It sends only to project-team addresses and is limited to two messages per hour for the whole project. Configure a transactional provider under **Authentication → Emails → SMTP Settings** before inviting students.

Never store SMTP credentials in the repository or a public environment variable. Configure SPF, DKIM and DMARC for the sending domain, and disable link tracking for authentication emails.

## Magic Link / OTP template

After custom SMTP is enabled, set the **Magic link or OTP** template to include both a code and the server-verifiable token-hash link:

```html
<h2>Sign in to RATEDUKE</h2>
<p>Enter this code on the sign-in page:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 0.2em;">{{ .Token }}</p>
<p>Or use this link:</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Sign in to RATEDUKE</a></p>
<p>This email expires shortly. Use only the newest email.</p>
```

The code flow is resilient when a mailbox opens the message on a different browser. The token-hash callback avoids relying on a PKCE verifier cookie. Supabase's official guidance recommends OTP entry when a corporate email security scanner may prefetch and consume links.

## User data path

1. Supabase creates the identity in `auth.users`.
2. `private.sync_auth_user()` creates or refreshes `private.profiles` and `private.account_roles`.
3. The staff-only Users page reads account status, role, suspension, creation time, last sign-in, review count and Campus Pulse response count through the RLS-bound `get_app_data()` RPC.
4. Reviews, dimension values and Pulse responses use the authenticated Supabase user ID; public review payloads never expose that ID or the email address.

The application does not use a runtime service-role key. Authentication user deletion and credential-level changes remain operator actions in the Supabase Dashboard; app administrators manage roles and contribution suspension through RATEDUKE.
