# After the current forum release

## Shipped in 0.4

- School-scoped public forum with photo masonry feed, Hot/Latest ordering, 1–9 image posts, cover selection and keyboard-accessible image ordering.
- Verified same-school posting, likes, comments, arbitrary-depth replies, deletion tombstones, reporting and staff hide/restore moderation.
- Transparent editorial cold start for Duke with no impersonated student accounts and no seeded likes.

## P1 — Explicitly deferred

- Helpful votes and entity discussion/replies outside the Forum.
- Campus Pulse discussion, prediction-accuracy profiles, streaks and participation rewards.
- Cross-product What's Hot outside the Forum.
- Configurable tags and tag filtering.
- Validated CSV import with preview and overwrite confirmation.
- Entity and edit suggestions with staff approval.
- Analytics events and richer administrator metrics.

## P2 and later

Points, badges, QR campaigns, campus activities, referrals and other engagement tools remain out of scope. Do not add direct messages, an anonymous general feed, individual-student/professor ratings, payments, a marketplace or an AI chatbot to this MVP.

## Before expanding beyond early testing

- Move catalog queries and rating aggregates to scoped/paginated SQL interfaces, preserving the frontend repository contract.
- Replace the MVP global write lock with targeted locking when write contention is measured.
- Add automated hosted Supabase integration checks in a staging project and a documented recovery drill.
- Add richer privacy controls, account-deletion/retention policy and moderation evidence retention based on real operating needs.
- Evaluate a dedicated status/incident workflow after a production deployment is selected.
