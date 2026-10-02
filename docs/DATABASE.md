# RATEDUKE data architecture

This document is the current map of RATEDUKE's persisted data, runtime projections, and ownership boundaries. It describes the schema produced by every migration in `supabase/migrations/`, not only the original P0 schema.

## 1. Source of truth

Use these files in this order when changing data behavior:

1. `supabase/migrations/` — production schema, constraints, RLS, grants, RPCs, and Storage policies.
2. `lib/types.ts` — application-facing records and view models.
3. `lib/domain.ts` — validation and the Demo implementation of permanent business rules.
4. `lib/repository.ts` — the single adapter that selects Demo or Supabase and hydrates signed image URLs.
5. `supabase/seed/demo.ts` — fictional local records and backward-compatible Demo upgrades.

`docs/PRD.md` defines product intent. When prose and an applied migration differ, the migration is the database truth and the discrepancy should be resolved explicitly.

## 2. System shape

```text
Supabase Auth                         Supabase Storage
auth.users                            entity-images (private)
    │                                 forum-images  (private)
    ▼                                       │
private.profiles ── private.account_roles   │ signed URLs
    │                                       ▼
    ├── reviews ── rating_values      lib/repository.ts
    ├── question_responses                  │
    ├── entity_submissions                  ▼
    ├── forum_posts/comments/likes    Snapshot + paginated Forum views
    ├── reports                             │
    └── audit_log / rate_limits             ▼
                                      Server-rendered components
public.schools
    ├── categories ── rating_dimensions
    │       └── entities ── entities (parent/child)
    └── questions ── question_options
```

The `public` and `private` names are PostgreSQL schemas. A table being in `public` does not mean that browser clients may select it directly. Raw table privileges are revoked from `anon` and `authenticated`; browser-visible data is returned through narrow RPC projections.

## 3. Logical domains

### 3.1 Catalog and ratings

```text
School 1 ── N Category 1 ── N RatingDimension
   │              │
   │              └── N Entity ── N Entity (recursive parent)
   │                         │
   │                         └── N Review ── N RatingValue
   │                                   ▲
   └───────────────────────────────────┘ school-domain eligibility
```

- A category may be school-specific or global (`school_id = null`).
- An entity always belongs to exactly one school and one category.
- Entity slugs are globally unique. Category slugs are unique within their school/global scope, with extra application checks to prevent ambiguous global-versus-school URLs.
- `entities.metadata` holds category-specific facts as a bounded JSON object instead of adding category-specific columns.
- `entities.parent_entity_id` supports arbitrary-depth same-school hierarchies. The command layer rejects self-links, cross-school parents, and cycles.
- A user has one durable review slot per entity. Editing upserts that slot; soft deletion preserves it so a hidden review cannot bypass moderation by being deleted and recreated.
- Overall and dimension scores use `numeric(3,1)`, range `1.0–10.0`, in `0.5` steps. Overall score may be null when dimension scores are present.
- Disabling a dimension hides it from new forms without deleting historical `rating_values`.

### 3.2 Identity and authorization

```text
auth.users 1 ── 1 private.profiles 1 ── 1 private.account_roles
```

- `profiles` contains private email, nickname, verification state, and sign-in timestamps.
- `account_roles` contains authorization state: `user`, `moderator`, or `admin`, plus suspension.
- A trigger synchronizes trusted email and verification values from `auth.users`; roles never come from user-editable auth metadata.
- Contribution permission is school-scoped: verified account, active role, active school, and an exact match between the email domain and `schools.email_domain`.
- Public reviews omit `user_id` and email. They expose `public_identity` and `verified`; staff projections may add `account_id` for moderation.

### 3.3 Campus Pulse

```text
School 1 ── N Question 1 ── 2..4 QuestionOption
                         │
                         └── N QuestionResponse ── 1 Profile
```

- `questions.type` is `prediction` or `poll`.
- Each student has one response slot per question: primary key `(question_id, user_id)`.
- A composite foreign key guarantees that a selected option belongs to the response's question.
- Predictions require close/event timestamps and may resolve to one option. Polls cannot be resolved predictions.
- Open unanswered questions expose participation count but not option distribution. Distribution becomes visible to staff, the answering user, or after close/resolution.

### 3.4 Community publishing and conversation

```text
Profile/ManagedIdentity 1 ── N EntitySubmission ── 1 Entity ── tags
                                      │                ├── one official primary tag
                                      │                └── zero to five school custom tags
                                      └── 1..5 private entity images
Entity 1 ── N Review / CommunityComment ── N flat Reply
                                      └── N unique CommunityLike
```

- Uploads remain private drafts until all image slots are ready. Finalization immediately and transactionally creates the entity, tag links, public author byline, gallery, and publisher's first rating.
- Only categories with `accepts_submissions = true` accept this workflow.
- The browser normalizes one to five ordered images to WebP before they enter the private `entity-images` bucket; the first image is the cover.
- Official tags are global protected configuration. Custom tags are normalized to lower-case slugs, deduplicated per school, and can be merged or archived by administrators.
- Each real user or managed contributor has one rating slot per Community entity. Top-level comments are unlimited within rate limits. Replies always retain the original root, so the public conversation is visually one level deep.
- Likes use one `(target_type, target_id, user_id)` record and may target ratings, comments, or replies. Hidden/deleted content is excluded from public counts and Hot ranking.
- Public Community projections expose nicknames and engagement only; account IDs, emails, and administrator status remain private.

### 3.5 Forum

```text
School 1 ── N ForumPost 1 ── 1..9 ForumPostImage
                         │
                         ├── N ForumComment ── N ForumComment (recursive replies)
                         └── N ForumPostLike ── 1 Profile
```

- A post or comment has exactly one author source: a real `author_user_id` or a transparent seeded `editorial_identity_id`, never both.
- Post lifecycle: `draft → published | hidden | deleted`. Comment lifecycle: `published | hidden | deleted`.
- A composite foreign key keeps every reply in the same post as its parent.
- `(post_id, user_id)` is the like primary key, so a user can like a post only once.
- The cover image is constrained to an image belonging to the same post.
- User images live in the private `forum-images` bucket. Seed images use versioned bundled paths under `public/forum-seed/`.
- Forum data is deliberately excluded from the application-wide snapshot and is fetched through paginated, identity-redacted RPCs.

### 3.6 Moderation and operational data

- `reports` is a polymorphic moderation queue for `review`, `entity`, `user`, `forum_post`, `forum_comment`, and `community_comment`. Only one pending report is allowed per reporter/target pair.
- `target_author_user_id` denormalizes the internal author of forum content for staff workflows. `target_id` is intentionally polymorphic and therefore has no single foreign key.
- `audit_log` records staff and admin mutations. The staff snapshot returns only the latest 100 entries.
- `rate_limits` stores hourly counters per user and action. The write RPC enforces limits at the database boundary.

## 4. Table dictionary

Community adds two public configuration/relationship tables and four private content/upload tables to the original application schema.

### Public-schema tables

| Table | Purpose | Important relationships and invariants |
| --- | --- | --- |
| `schools` | Campus tenant and allowed email domain | Unique `slug`; `status = active | archived` |
| `categories` | Data-driven discovery and rating category | Optional `school_id`; scoped slug uniqueness; one school-specific discover default; submission capability flags |
| `entities` | Any discoverable/rateable place or resource | Required school/category; recursive parent; global slug; bounded `metadata`; optional Storage `image_path` |
| `rating_dimensions` | Configured score axes per category | Unique `(category_id, key)`; fixed 1–10 scale; required/active flags |
| `questions` | Prediction or poll configuration | School-scoped; status/timestamp rules; optional resolved option |
| `question_options` | Two to four configured choices | Unique label and order per question; composite identity supports safe option references |
| `tags` | Official and school custom Community tags | Protected official slugs; school-scoped custom slug uniqueness; active/archived lifecycle |
| `entity_tags` | Entity-to-tag relationship | Exactly one primary official tag and at most five custom tags per Community entity |

### Private-schema tables

| Table | Purpose | Important relationships and invariants |
| --- | --- | --- |
| `profiles` | Private account identity synchronized from Auth | PK/FK to `auth.users`; email and verification are not public projections |
| `account_roles` | Role and suspension state | One-to-one with profile; authorization source of truth |
| `reviews` | One user's evaluation of one entity | Unique `(user_id, entity_id)`; soft-delete tombstone; published/hidden moderation state |
| `rating_values` | One dimension score within a review | PK `(review_id, rating_dimension_id)`; 1–10 half-step score |
| `question_responses` | One selected option per user/question | PK `(question_id, user_id)`; option must belong to question |
| `entity_submissions` | Student-proposed entity plus initial review | Owner/school/category/image; moderation lifecycle; unique optional resulting entity |
| `reports` | Moderation reports across supported content types | Partial unique pending report index; optional staff reviewer and target author |
| `audit_log` | Staff/admin mutation history | Actor, action, target, timestamp |
| `rate_limits` | Database-enforced hourly write counters | PK `(user_id, action, bucket)` |
| `forum_editorial_identities` | Transparent names for bundled seed content | Unique display name; never impersonates an account |
| `forum_posts` | School-scoped photo-led posts | Real XOR editorial author; lifecycle; cover FK to own image |
| `forum_post_images` | Ordered forum image metadata | One path source (`storage_path` XOR `bundled_path`); unique order per post |
| `forum_comments` | Arbitrarily nested post discussion | Real XOR editorial author; same-post parent FK; deletion tombstones preserve descendants |
| `forum_post_likes` | Unique user likes | PK `(post_id, user_id)` |
| `community_entity_authors` | Public nickname source for a Community entity | Exactly one real user or managed contributor, never both |
| `community_comments` | Top-level comments and flattened replies | Optional review root; reply-to attribution; deleted rows remain private for audit but are omitted from conversations |
| `community_likes` | Rating/comment/reply likes | PK `(target_type, target_id, user_id)`; real accounts only |
| `entity_submission_images` | Ordered Community gallery uploads | One to five ready private paths linked to the published entity |

Supabase-managed `auth.users`, `storage.buckets`, and `storage.objects` are dependencies but are not application-owned tables.

## 5. Application-facing data contracts

### 5.1 Main `Snapshot`

`get_app_data()` plus `get_community_data()` and Demo `publicSnapshot()` produce the same logical contract:

| Field | Guest/user visibility | Staff/admin visibility |
| --- | --- | --- |
| `schools`, `categories`, `entities`, `dimensions` | Active public catalog | Includes archived configuration for management |
| `reviews` | Published, non-deleted, author-redacted | Includes hidden reviews and internal `account_id` |
| `own_reviews` | Current user's non-deleted reviews | Same ownership rule |
| `own_submissions` | Current user's non-draft submissions | Same ownership rule |
| `admin_submissions` | Empty | Admin-only full queue with internal author details |
| `questions` | Non-draft/non-archived with result redaction | Full configuration and results |
| `accounts`, `reports`, `audit` | Empty | Staff-only; submissions remain admin-only |
| `viewer` | Current private account projection or null | Current private account projection |
| `tags`, `entity_tags`, `community_authors`, `community_comments` | Public identity-redacted Community data | Adds hidden content and management counts where authorized |

Database-only `image_path` values are removed in `lib/repository.ts` and replaced with one-hour signed `image_url` values before components receive the snapshot.

### 5.2 Forum views

Forum reads have separate contracts because they need independent growth and pagination:

- `ForumPage<ForumPostCard>` for Hot/Latest feeds.
- `ForumPostDetail` for one post and all of its hydrated image URLs.
- `ForumPage<ForumCommentNode>` for roots or replies.

These projections expose `author_name`, counts, permissions, and public content; they do not expose account IDs or emails.

### 5.3 Read interfaces

| Interface | Responsibility |
| --- | --- |
| `get_app_data()` | Full MVP catalog/account-aware snapshot |
| `search_entities(query, school)` | PostgreSQL English full-text search returning entity IDs |
| `get_forum_feed(...)` | School-scoped, max-50-row paginated feed |
| `get_forum_post(id)` | Identity-redacted post detail |
| `get_forum_comments(...)` | Paginated root or child comments |
| `get_community_data()` | Tags, galleries, Community conversation, like state, and authorized admin statistics |

### 5.4 Write interfaces

| Interface | Responsibility |
| --- | --- |
| `app_command(action, data)` | Validated transactional reviews, admin config, moderation, profile, and forum actions |
| `answer_question(question, option)` | Eligible response upsert plus refreshed aggregate view |
| `begin/mark/finalize/cancel_entity_submission` | One-to-five-image private draft and immediate atomic Community publication |
| `begin/mark/finalize/cancel_forum_post` | Forum draft and multi-image lifecycle |
| `bootstrap_admin(email)` | One-time trusted initialization; never callable by normal web roles |

Server actions call `lib/repository.ts`; components do not issue raw table writes.

## 6. Demo and Supabase parity

| Concern | Demo mode | Supabase mode |
| --- | --- | --- |
| Persistence | `.local/demo.json` | PostgreSQL migrations |
| Identity | HTTP-only `rateduke-demo-user` cookie | Supabase Auth cookie/session |
| Business rules | `lib/domain.ts` | RLS-bound SQL RPCs |
| Reads | `publicSnapshot()` | `get_app_data()` and forum RPCs |
| Entity uploads | `.local/entity-images/` with a demo-only protected media route | Private `entity-images` bucket with signed URLs |
| Forum uploads | `.local/forum-images/` | Private `forum-images` bucket |
| Production | Explicitly rejected | Default and required |

`Database` in `lib/types.ts` is the normalized in-memory Demo store. It mirrors application tables as arrays but does not model PostgreSQL schemas, grants, triggers, or Storage objects. Demo and SQL implementations must be updated together whenever a permanent rule changes.

## 7. State values

| Record | Allowed states |
| --- | --- |
| School/category/entity | `active`, `archived` |
| Account role | `user`, `moderator`, `admin` plus independent `suspended` |
| Review | `published`, `hidden` plus independent `deleted_at` tombstone |
| Question | `draft`, `open`, `closed`, `resolved`, `archived` |
| Submission | `draft`, `approved` for new Community publishing; legacy `pending`/`rejected` rows remain readable |
| Community comment | `published`, `hidden`, `deleted` |
| Tag | `active`, `archived` |
| Forum post | `draft`, `published`, `hidden`, `deleted` |
| Forum comment | `published`, `hidden`, `deleted` |
| Report | `pending`, `resolved` |
| Forum image | `pending`, `ready` |

## 8. Security boundary

- Every application table has RLS enabled, including private-schema tables used behind RPCs.
- `anon` and `authenticated` cannot select or mutate raw application tables.
- Public RPCs are owned by `rateduke_api`, a non-login, non-superuser role without `BYPASSRLS`.
- RPCs derive the caller from request JWT state; they never accept a caller-supplied user ID.
- `service_role`/secret credentials are absent from runtime code. `SUPABASE_SECRET_KEY` is accepted only by `scripts/bootstrap-admin.mjs` in a trusted operator environment.
- Both Storage buckets are private. Reads use short-lived signed URLs after database policy checks.
- RLS is defense in depth; command functions also validate ownership, role, school domain, record state, and cross-record consistency.

See `docs/SECURITY.md` for the operational launch checklist.

## 9. Current scale boundaries

- The main snapshot reads the available catalog, questions, and reviews and aggregates ratings in the application. This is appropriate for the MVP dataset, not for a large multi-campus corpus.
- Forum data already uses server pagination and is intentionally outside the snapshot.
- Before broader scale, move catalog filtering, review pagination, and rating aggregation into scoped SQL queries or materialized aggregates.
- `reports.target_id` is polymorphic. Adding a new reportable type requires coordinated validation and moderation-projection changes because a universal FK cannot enforce it.
- TypeScript interfaces are handwritten rather than generated from the database. Migration changes must update `lib/types.ts`, SQL projections, Demo records, and tests together.
- Configuration writes are intentionally serialized with advisory locks for MVP correctness. Narrower locking will be needed under significant concurrent write volume.

## 10. Change checklist

When adding or changing persisted data:

1. Create a new migration; never rewrite an applied migration.
2. Add constraints, indexes, RLS, grants, and projection changes in the same design pass.
3. Update `lib/types.ts` and, when applicable, `Database`/`Snapshot`.
4. Update both SQL RPC behavior and `lib/domain.ts` Demo behavior.
5. Update `supabase/seed/demo.ts` and `upgradeDemo()` for newly required Demo fields.
6. Preserve public identity redaction and keep raw author/email fields out of guest projections.
7. Add database-contract and domain tests for the new invariant.
8. Run `npm test`, `npm run typecheck`, and `npm run build`.
9. For a displayed configuration change, verify the value in the running Supabase-backed UI, not only in source or migration files.
# Official entity galleries

Administrators manage ordered entity images through `private.entity_gallery_images`. Existing metadata galleries are migrated into this table, while uploaded files remain private in the `entity-images` bucket and are rendered through short-lived signed URLs. The first ready image by `sort_order` is the entity cover. Admin-only RPCs reserve unique upload paths, finalize uploads, and atomically reorder, relabel, or remove gallery items; every published gallery change is audited.
