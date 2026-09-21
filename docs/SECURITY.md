# Security and operational verification

## Access model

All application tables enable PostgreSQL RLS. The browser only gets a Supabase publishable key. Next.js uses the caller's auth cookies and makes RPC calls with that identity; it never initializes a runtime service-role client.

Public application RPCs use `SECURITY DEFINER` with owner `rateduke_api`, a dedicated `NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS` role. This role does not own the tables. Consequently the RPCs remain subject to the table policies and `auth.uid()` refers to the original request identity. Clients have no direct business-table grants; mutations must pass the reviewed command contract. Small private role/domain helpers run with owner privileges to avoid recursive RLS checks, use a fixed empty search path, and do not accept a caller-supplied user identity. No private helper is exposed to anon/authenticated.

Private profiles are readable to the internal RPC role so public review projection can obtain a nickname and verified flag. They are **not** directly readable by clients. `get_app_data` projects only the caller's own account, or staff-authorized accounts. Do not grant direct private-schema usage or expose the schema in API settings.

The bootstrap function is executable only by the Supabase service role, not by application sessions. It is used by a one-off local script and refuses to overwrite an existing active administrator.

## Contributions and moderation

- Email must be verified and its lowercase domain exactly match the entity school's configured domain. Subdomains do not implicitly match. Browsing and signing in are allowed without contribution eligibility.
- Suspended accounts can read their own profile but cannot submit mutations or use staff access.
- One unique review per user/entity. Ratings and dimension values commit atomically.
- Initial reviews publish immediately; staff can hide or restore them. Hidden and deleted reviews do not affect public aggregates.
- Users may edit/delete their own content; neither action removes a moderation hold. Deletion scrubs body and scores while retaining the uniqueness/moderation tombstone.
- Moderator can suspend ordinary users, but cannot change a user to a staff role or modify existing staff. Admin manages roles. Self-demotion/suspension through the UI is prohibited; at least one active administrator must remain.
- Reports target a review, entity, forum post, or forum comment. A review report also gives staff the author association for user-level action. Resolution and content visibility are separate actions and are logged.
- Forum writes require an active, verified account whose exact email domain matches the post school. User-authored rows always carry the real private account ID; only migration-owned editorial rows may use `RATEDUKE Campus Team` or `Campus Contributor`. Public RPCs expose nicknames, never account IDs or email.
- Hidden forum posts leave the feed and stop new interactions. Hidden and deleted comments remain as tombstones so descendants keep their context. Post, comment, and like writes are capped at 5, 30, and 120 per account/hour.
- `forum-images` is private. JPEG, PNG, and WebP input is limited to 5 MB, normalized by Sharp to metadata-free WebP with a 2,000 px maximum edge, stored at immutable user/post/image paths, and read through short-lived signed URLs. No runtime service-role client is present.
- Campus Pulse responses require an active, verified student whose exact email domain matches the question school. Response rows and user IDs stay private. Open unanswered questions hide option distributions; closed and resolved aggregate projections never include participant identities.
- Predictions close against the database clock. Resolution requires an option from the same question and an event time in the past. Student Stats questions cannot carry event results.

## Input and abuse controls

Zod validates the demo domain and shared server submission contracts; database casts, checks and RPC validation independently enforce connected-mode integrity. Text is rendered as React text nodes (no HTML injection). External URLs must use HTTP(S) and open with `rel=noreferrer`. Metadata is a size-limited JSON object and is displayed generically as text.

Review changes are capped at 20, reports at 10 and Campus Pulse response writes at 60 per authenticated user/hour. SQL counter increments and writes are transactional and concurrency-safe. Login/email rate limits are provided by Supabase Auth; configure SMTP and Auth limits for the actual project. The default Auth service is not a production mail-delivery guarantee. This implementation does not add Redis or third-party anti-spam infrastructure.

Next.js Server Actions use POST and the framework's origin protections. Production cookies are managed by Supabase SSR. The session-refresh proxy calls `auth.getUser()`; authorization is always checked again in the database. Demo identity cookies are HTTP-only, SameSite Strict and are ignored outside explicit local demo mode. No private RPC payload or public response is cached across users.

## Live checklist after configuration

1. Apply migrations to a staging project. Confirm only public API schema is exposed.
2. Complete a real email Magic Link sign-in from the configured origin and verify callback failure/expiry behavior.
3. Verify an actual student email grants contributions only at its own school, including changed email and unverified account cases.
4. Repeat the dynamic-category, duplicate-review, anonymous response, report, hidden-review and suspended-user tests with actual Supabase JWTs, including direct RPC calls outside the UI.
5. Inspect network responses as a guest and ordinary user: no author IDs/emails, role lists, reports or audit data.
6. Confirm Vercel environment variables contain only the publishable key. Remove the local bootstrap secret and check no secrets entered the repository.
7. Test login and review paths on phone and desktop using the final domain.
8. Perform and record the backup/restore drill below before public use.

## Backups and restore

The website itself cannot create a hosted backup policy. Check the project's available Supabase backup retention and enable the appropriate daily backups/PITR for its plan. Record who owns recovery and the accepted recovery window.

For an additional encrypted logical export, use PostgreSQL tooling from a trusted operator environment and store the output outside this repository. Include application public tables, all private tables, and the required auth account mapping; do not assume a public-only schema export can restore anonymous authorship or roles. Never place connection strings, JWT signing secrets or dumps in browser-accessible storage.

Restore a backup into an isolated staging project, confirm schema/role/function ownership, RLS and Auth account IDs, and run the live access tests before considering the backup usable. Supabase-managed Auth/system schemas and role grants need provider-compatible restoration procedures; use Supabase's current documented restore flow for the selected backup type. Log the backup timestamp, restore duration and test result. Embedded PostgreSQL tests do not validate a hosted recovery.

## Current verification boundary

Embedded PostgreSQL tests execute the committed SQL and verify RLS/RPC behavior with an isolated mock Auth schema. Demo browser tests cover UI flows. Neither simulates Supabase's email service, JWT gateway, real project configuration or Vercel runtime. Those remain explicit live-verification tasks after credentials and a deployment are supplied.

## Implementation references

The restricted function-owner transfer follows [PostgreSQL ALTER FUNCTION ownership requirements](https://www.postgresql.org/docs/18/sql-alterfunction.html). Schema exposure and definer review follow [Supabase API security guidance](https://supabase.com/docs/guides/api/securing-your-api). Actual hosted verification remains required.
