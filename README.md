# RATEDUKE

A configurable, ratings-first campus discovery MVP. Students browse dynamic categories, compare descriptive rating evidence, and review campus listings without formal rankings. Built with Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui's Button pattern, Radix Slot and Supabase. All visible content is English.

## Run locally

Requires Node.js 22.16+ (tested with 24.15) and npm.

```powershell
npm install
npm run dev
```

Copy `.env.example` to `.env.local`, add the Supabase project URL and publishable key, then open **http://127.0.0.1:3000**. The application now defaults to **Supabase mode**, so ratings and reviews are stored in the configured database.

To use the fictional local dataset for isolated UI testing, explicitly set `DATA_MODE=demo`. Demo mode never runs in production and never writes to Supabase.

Use **Fictional demo** in the strip below the header to switch between guest, an Example University student, a Duke student, administrator, moderator and a student from another school. As administrator you can reset the fictional data or start with a completely empty campus. Demo records persist in `.local/demo.json` across restarts. Reset replaces all local demo records; it never changes Supabase.

### Try the core loop

1. Switch to Administrator and open **Admin**.
2. Add a category, then its rating dimensions and a new entity. All controls are under the matching management sections.
3. Switch to Verified student, open that entity, and submit a rating with or without a written review.
4. Edit your existing review, or report a review.
5. Switch to Moderator. Open **Admin → Moderation**, hide or restore a review, and resolve the report.
6. Switch to Guest to see the public result. Hidden and deleted reviews are excluded from public ratings.

Only the fictional identities have a fixed role switch, and only in local development. They are never school authentication. The production server refuses `DATA_MODE=demo`.

### Try Campus Pulse

1. Choose **Duke University**, then open **Campus Pulse**.
2. As Guest, browse open Predictions without seeing option percentages.
3. Switch to **Verified Duke student**, answer a Prediction, and change the choice before it closes.
4. Open **Student Stats** to answer a quick poll and inspect aggregate stories with sample sizes.
5. As Administrator, use **Admin → Questions** to create a 2–4 option question, configure popup/featured placement, close it, or resolve a Prediction after its event time.

## Connect Supabase

1. Create a Supabase project using PostgreSQL 17 or newer. Copy `.env.example` to `.env.local`.
2. Set `DATA_MODE=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000`. Do not use a service-role/secret key as the publishable key.
3. Run every committed file in `supabase/migrations/` in filename order using the project's SQL editor, or link the Supabase CLI to your project and run `supabase db push`. The catalog migration creates Duke University, data-driven Dining and Housing dimensions, and the supplied 80-location hierarchy. For ongoing changes use new migration files, not ad hoc SQL edits. Keep the private schema out of the exposed API schemas.
4. In **Authentication → URL Configuration**, set the Site URL and allow `http://127.0.0.1:3000/auth/callback`. If using localhost instead, set and allow that exact origin. Configure the final production origin separately.
5. Enable email sign-up and email verification. Complete the required SMTP and Magic Link/OTP template configuration in [`docs/AUTH_SETUP.md`](docs/AUTH_SETUP.md). The callback supports PKCE codes and token hashes; the login page also accepts the six-digit OTP for cross-browser and email-scanner-safe sign-in.
6. Restart the dev server and sign in with the account that should become the initial administrator. The mailbox must be verified before the next step. No school record is needed for this initial login.
7. In a trusted local environment, temporarily set `SUPABASE_SECRET_KEY` to the project's secret/service-role credential and run:

```powershell
npm run bootstrap-admin -- your-verified-email@example.edu
```

8. Remove `SUPABASE_SECRET_KEY` after initialization. This setup command is the only code path that uses it; the website never reads it. The bootstrap function refuses to run when an active administrator already exists.
9. Open `/admin` to review or extend the seeded Duke catalog. New schools, categories, dimensions and entities remain fully database-configurable.

For local Supabase development, install the Supabase CLI and Docker, then use `supabase start` and `supabase db reset`. Test confirmation links via the local mail inbox provided by Supabase. These tools are optional for the standalone Demo mode.

## Validation

```powershell
npm test
npm run typecheck
npm run build
# With npm run dev running in a second terminal:
npm run test:e2e
```

`npm test` exercises the TypeScript rules and executes the actual SQL migration with embedded PostgreSQL (PGlite), including RLS and restricted RPC roles. It creates an isolated mock of the Supabase Auth schema; it does not send mail or connect to a hosted project.

Browser tests use an installed Windows Chrome when available, otherwise Playwright's bundled Chromium (`npx playwright install chromium`). They reset **local demo data** and restore the sample dataset afterward. Do not run them against valuable demo edits. The production database is never used by these tests. Core screenshots go to `.impeccable/review/`, Campus Pulse acceptance screenshots go to `output/playwright/`, and test failures go to `test-results/`.

## Deploy to Vercel

1. Commit the source and lockfile to your own repository; exclude `.env.local`, `.local`, `.next` and `node_modules`.
2. Import the repository into Vercel. Use the Next.js preset and `npm run build`.
3. Configure `DATA_MODE=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL=https://your-domain` in the target environment. Do **not** configure the setup secret in Vercel.
4. Apply the SQL migrations to the intended Supabase project before enabling traffic. Add the exact production callback URL to Supabase Auth.
5. Deploy and run the live checklist in `docs/SECURITY.md`. Confirm the database backup/restore process for the project's plan before a public launch.

The production build can compile without Supabase credentials; opening an unconfigured production server shows a connection/setup error rather than fabricated campus data. `npm run start` is for a Supabase-configured production build, not for the local demo.

## Project map

- `app/`: server-rendered routes, actions, auth callback and theme.
- `components/`: generic Discover, entity rating, review, Campus Pulse, account and admin UI.
- `lib/`: typed domain rules, public projections, demo persistence and Supabase adapters.
- `supabase/migrations/`: production schema, access policies, transactional commands and search.
- `supabase/seed/demo.ts`: explicitly fictional, replaceable development examples.
- `tests/`: domain tests, SQL integration tests and browser acceptance test.
- `docs/`: original PRD, database design, security and visual notes.

## Delivery limits

This is the P0 implementation. The hosted Supabase schema, publishable-key snapshot, raw-table denial, authenticated review transaction, Auth Site URL and local redirect allow list have been verified. Custom SMTP plus the OTP template, a fresh mailbox round trip, backup/restore and Vercel deployment still require operator configuration. See `BACKLOG.md` for deferred features and scaling work.
