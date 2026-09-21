# Validation record

## Forum release additions

- Domain and embedded PostgreSQL coverage verifies eight transparent Duke seed posts, 27 comments, multi-level replies, no fake likes, public identity redaction, Hot/Latest ordering, unique like toggles, cross-post reply rejection, deletion tombstones, exact-school eligibility, reporting, hide moderation, private draft publishing, and non-`BYPASSRLS` RPC ownership.
- Browser acceptance covers navigation order, responsive masonry, feed/detail/composer surfaces, image ordering and cover selection, nested conversation loading, and guest versus verified-student states. Generated demo media is documented in `public/forum-seed/SOURCE.md`.

## Passed locally

- `npm test`: **50 tests passed**, including actual migration execution in embedded PostgreSQL, Auth error handling, synchronized account activity, RLS-bound RPCs, public identity projection, the complete 80-entity Duke demo catalog, Forum authorization and moderation, hidden-post comment isolation, dynamic dimensions, moderation persistence, rate limiting and empty-state data behavior.
- The migration also installed under an isolated managed-style, non-superuser PostgreSQL operator with explicit function-owner privileges.
- `npm run typecheck`: passed. The final `npm run build` also passed TypeScript verification.
- `npm run build`: successful Next.js production build.
- `npm run test:e2e`: **3 browser acceptance scenarios passed**, covering desktop/mobile discovery and search; admin category/dimension/entity creation; ratings and moderation; Campus Pulse; and the Forum navigation, responsive masonry, Hot/Latest ordering, three-image upload/reorder/cover selection, publishing, liking, commenting, reporting, moderator hiding and public removal. Browser console/page errors are asserted absent.
- Responsive checks: 1440px desktop and 390px phone, including entity detail. No horizontal overflow in the checked phone views.
- Production smoke check on a temporary local port: unconfigured production returned the setup screen; no fictional campus name or demo controls were rendered. That temporary production server was then stopped.
- Local development preview remains at `http://127.0.0.1:3000` in Supabase mode with the hosted Duke catalog.

## Visual and finish review

The Forum feed, detail, and composer were reviewed at 1440px desktop and 390px phone using `forum-feed-*`, `forum-detail-*`, and `forum-new-*` screenshots under `output/playwright`. The masonry remained in DOM reading order, phone layouts had no horizontal overflow, and the two-column phone feed intentionally falls back to one column only below 340px.

An independent finish review found that hidden-post comments remained callable, published image objects could be deleted directly, draft cleanup ignored Storage errors, and restore was not exposed in moderation. These were corrected with a parent-post gate, draft-only Storage deletion, checked cleanup errors, and hide/restore controls. Forum visual checks supplement the earlier discovery, entity, administration, and empty-state review.

## Passed against hosted Supabase

- Created the `RATEDUKE` project in `us-east-1` and applied all committed migrations through the Supabase migration API.
- Confirmed the hosted catalog contains one school, two categories, six rating dimensions and 80 entities.
- Confirmed the publishable-key Data API can call the public snapshot RPC while direct access to raw tables is rejected with PostgreSQL error `42501`.
- Executed an authenticated `save_review` transaction against the hosted database, verified the review and three dimension values through the caller projection, then rolled the transaction back. No test account or review remained.
- Verified every business table has RLS enabled. The RPC owner remains a non-login, non-`BYPASSRLS` role.
- Ran Supabase security and performance advisors. The remaining SECURITY DEFINER notices describe the intentional public read/authenticated write RPC surface; the functions use RLS and explicit role grants. Foreign-key index findings were resolved.
- Restarted the local Next.js server with `.env.local` and visually confirmed the browser renders Duke University with 45 Dining and 35 Housing listings from Supabase.
- Set the hosted Auth Site URL to `http://127.0.0.1:3000` and added exact callback allow-list entries for both `127.0.0.1` and `localhost`.
- Confirmed one real, verified Auth user is synchronized to one private profile and one account-role row with a stored last-sign-in timestamp and zero synchronization gaps. No email address was copied into validation output.
- Applied the account activity migration to the hosted schema and verified the staff projection can report creation time, last sign-in, review count and Campus Pulse response count without exposing those fields publicly.

## Still requires operator configuration

Custom SMTP credentials and the Magic Link/OTP template in `docs/AUTH_SETUP.md` are still required because Supabase's built-in sender only delivers to project-team addresses and is limited to two project emails per hour. A fresh real-mailbox OTP round trip, initial administrator promotion, a database backup/restore drill and Vercel deployment also remain outstanding.

The Forum migration is delivered and verified locally/inside embedded PostgreSQL only. It has not been applied to the previously connected hosted Supabase project, and the new private bucket, storage policies, signed-image path, and Forum JWT behavior still require staging verification before production use.

Interrupted browser sessions can leave private draft rows and objects. Before production, schedule a retention job that removes stale drafts and their objects after a documented grace period.
