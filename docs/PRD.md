
# Campus Review Platform

## MVP Product & Engineering Requirements

**Version:** 0.4
**Status:** MVP + campus forum
**Primary Platform:** Responsive Web Application
**Initial Campus:** Configurable
**Primary Language:** English
**Architecture Principle:** Data-driven, admin-configurable, no hardcoded campus entities

---

# 1. Product Overview

Build a student-powered campus discovery and review platform where verified students can discover, rate, review, and discuss campus resources.

The product should turn fragmented campus knowledge into structured, searchable, and continuously updated information.

The platform should support three major behaviors:

```text
Discover
Rate
Discuss
```

A lightweight engagement layer called **Campus Pulse** may also be included to improve retention.

The current release also includes a school-scoped, photo-led **Forum**. Public visitors can browse; active verified students whose exact email domain matches the selected school can publish, like, comment, reply, report, and delete their own content. The forum has no topic categories, tags, follows, direct messages, bookmarks, or public user profiles. It supports Hot and Latest ordering, 1–9 images per post, an explicit cover, arbitrary-depth replies with capped visual indentation, and staff hide/restore moderation.

The long-term vision is:

> **A student-powered guide to campus life.**

---

# 2. Core Product Principle

The application must be:

> **Data-driven rather than hardcoded.**

Developers must not hardcode:

* campus locations
* dormitories
* dining vendors
* study spaces
* clubs
* rating categories
* rating dimensions
* tags
* polls
* universities

into page components.

All of these should be configurable through the database and admin interface.

For example, the frontend must not contain logic such as:

```typescript
if (type === "dining") {
  showTasteRating();
}
```

Instead, the database should define which rating dimensions belong to each category.

Example:

```text
Category
    ↓
Rating Dimensions
```

This allows administrators to create new categories later without modifying frontend code.

---

# 3. MVP Objective

The MVP exists to answer:

> **Will students repeatedly use and contribute to a structured campus review platform?**

The MVP must allow users to:

* browse campus entities
* search campus entities
* view structured ratings
* read reviews
* authenticate with a school email
* submit ratings
* write reviews
* discuss an entity
* report inappropriate content

Administrators must be able to manage all platform data without modifying code.

---

# 4. Language Requirement

## Mandatory

All user-facing content must be written in English.

This includes:

* navigation
* buttons
* labels
* forms
* placeholders
* validation messages
* error messages
* empty states
* admin dashboard
* moderation tools
* notifications
* onboarding
* search
* review forms
* poll interfaces

Do not display Chinese text anywhere in the production UI.

Developer comments and documentation may be in English.

Prefer English throughout the entire codebase.

---

# 5. User Roles

The platform should support three roles:

```text
User
Moderator
Admin
```

---

## 5.1 User

Can:

* browse entities
* search entities
* view ratings
* view reviews
* view discussions
* create ratings
* write reviews
* edit own reviews
* delete own reviews
* mark reviews as helpful
* participate in polls
* create discussion posts
* reply to discussion posts
* report content
* suggest edits
* suggest new entities

---

## 5.2 Moderator

Can perform normal user actions plus:

* review reports
* hide inappropriate reviews
* hide inappropriate discussion posts
* resolve reports
* suspend users where permitted

---

## 5.3 Admin

Has full management access.

Can:

* manage schools
* manage categories
* manage entities
* manage rating dimensions
* manage tags
* manage polls
* moderate user-generated content
* manage users
* manage edit suggestions
* manage entity suggestions
* view platform analytics

---

# 6. Authentication

Use:

> **Supabase Auth**

Preferred login:

```text
Email Magic Link
```

or:

```text
Email OTP
```

The system must support restricting contribution permissions by school email domain.

Example:

```text
allowed_email_domain = duke.edu
```

The email domain must be stored as school configuration rather than hardcoded into the frontend.

---

# 7. Privacy Model

The platform uses:

> **Verified but Pseudonymous Identity**

Users must authenticate using a valid school email.

However, their public identity does not need to expose:

* full legal name
* school email
* student ID

The public UI may display:

```text
Anonymous Student
Verified Student
```

or:

```text
Anonymous Sophomore
Verified Student
```

Public anonymity should not mean platform anonymity.

The system must internally associate all contributions with a real authenticated account.

This supports the semi-anonymous model discussed during product planning: users should be able to express honest opinions publicly while the platform still maintains accountability internally. 

---

# 8. Core Data Architecture

The system must support the following conceptual hierarchy:

```text
School
  ↓
Category
  ↓
Entity
  ↓
Ratings / Reviews / Discussion
```

However, entities may also have parent-child relationships.

Example:

```text
Entity
  ↓
Child Entity
  ↓
Child Entity
```

This should support future structures such as:

```text
Building
  ↓
Vendor
  ↓
Menu Item
```

without requiring schema redesign.

---

# 9. Schools

Create a `schools` table.

Suggested fields:

```text
id
name
slug
email_domain
city
state
country
status
created_at
updated_at
```

Example future use:

```text
Duke University
UNC Chapel Hill
NC State University
```

Even if the MVP only contains one school, the database must support multiple schools.

---

# 10. Categories

Categories must NOT be hardcoded.

Create a configurable `categories` table.

Suggested fields:

```text
id
school_id nullable

name
slug
description
icon
status
sort_order

created_at
updated_at
```

Example categories may eventually include:

```text
Dining
Housing
Study Spaces
Clubs
Academic Resources
Campus Services
Events
```

But the MVP database may initially contain no categories.

Admins must be able to create them later.

---

# 11. Entities

An Entity is anything that users can discover, rate, or discuss.

Create an `entities` table.

Suggested fields:

```text
id
school_id
category_id

parent_entity_id nullable

name
slug
short_description
description

location_name nullable
address nullable
latitude nullable
longitude nullable

official_url nullable

source_name nullable
source_url nullable
last_verified_at nullable

metadata jsonb

status
is_featured

created_at
updated_at
```

---

# 12. Entity Hierarchy

Entities must support recursive parent-child relationships.

Use:

```text
parent_entity_id
```

Example:

```text
Parent Entity
    ↓
Child Entity
        ↓
Child Entity
```

The frontend must support displaying:

```text
Breadcrumb navigation
```

Example:

```text
Campus / Building / Vendor
```

without knowing the specific entity types in advance.

---

# 13. Entity Metadata

Different entities may require different factual data.

Do not add hundreds of category-specific columns to the `entities` table.

Use:

```text
metadata JSONB
```

for flexible information.

Example:

```json
{
  "amenities": ["Wi-Fi", "Laundry"],
  "floor_count": 4
}
```

or:

```json
{
  "cuisine": ["Asian"],
  "accepts_meal_plan": true
}
```

The platform should initially display metadata through a generic component.

A more advanced custom schema system may be added later.

---

# 14. Rating Dimensions

Rating dimensions must be fully configurable.

Create:

```text
rating_dimensions
```

Suggested fields:

```text
id
category_id

key
label
description

min_value
max_value

sort_order
is_required
is_active

created_at
updated_at
```

Example:

```text
Category:
Dining

Dimensions:
Taste
Meal Plan Value
Wait Time
```

But these examples must NOT be hardcoded.

Admins should be able to create:

```text
New Category
↓
New Rating Dimensions
```

without code changes.

---

# 15. Rating Scale

Universal application scale:

```text
1.0–10.0 in 0.5-point steps
```

Category dimensions remain configurable, but every overall and dimension score uses the same ten-point scale. The UI must use a direct numeric score and segmented meter rather than five-star imagery.

---

# 16. Ratings and Reviews

A rating represents one user's evaluation of one entity.

Create:

```text
reviews
```

Suggested fields:

```text
id
entity_id
user_id

overall_rating nullable

body nullable

is_anonymous
status

created_at
updated_at
```

---

# 17. Rating Values

Individual dimension scores should be stored separately.

Create:

```text
rating_values
```

Suggested fields:

```text
id
review_id
rating_dimension_id
score

created_at
updated_at
```

This allows new rating dimensions to be added without changing database structure.

---

# 18. Rating Rules

For MVP:

> One user may have only one active review per entity.

Database constraint:

```text
UNIQUE(user_id, entity_id)
```

Users may edit their existing review.

This reduces simple rating spam and was already identified during product planning as an important anti-abuse mechanism. 

---

# 19. Rating vs Written Review

A user must be allowed to submit:

```text
Rating only
```

without writing a long review.

Written review should be optional.

Reason:

The contribution flow must remain low friction.

Do not require a long minimum review length in the first version.

---

# 20. Entity Page

Every entity should use the same generic entity page.

Do not create separate hardcoded pages such as:

```text
DiningPage
DormPage
StudyPage
```

Use:

```text
EntityPage
```

The page should dynamically load configuration from the database.

---

# 21. Entity Page Structure

Recommended layout:

```text
Entity Header

Breadcrumb
Entity Name
Category
Location
Description
Official Information

Overall Rating

Rating Breakdown

Actions:
Rate
Write Review
Share

Reviews

Discussion

Suggest an Edit
Report
```

---

# 22. Rating Breakdown

The rating breakdown must be generated dynamically from:

```text
rating_dimensions
```

Example frontend flow:

```text
Entity
↓
Category
↓
Rating Dimensions
↓
Aggregate Scores
↓
Render
```

Never assume the category or dimensions inside the React component.

---

# 23. Review Card

Each review should display:

```text
Public identity
Verified status
Overall rating
Dimension ratings
Review body
Timestamp
Helpful count
Report button
```

Example:

```text
Anonymous Student
Verified Student

★★★★☆

“Good overall experience.”

Helpful 12
Report
```

---

# 24. Helpful Votes

Create:

```text
helpful_votes
```

Fields:

```text
id
review_id
user_id
created_at
```

Constraint:

```text
UNIQUE(review_id, user_id)
```

Users cannot mark the same review helpful more than once.

---

# 25. Search

Users should be able to search:

* entity name
* entity description
* location
* category

Use PostgreSQL / Supabase full-text search initially.

Do not introduce:

* Elasticsearch
* Algolia
* vector databases

for the first version.

---

# 26. Browse

Users should be able to browse by:

```text
School
Category
```

The category navigation must also be generated from database records.

Example:

```text
GET /categories
```

then render available categories dynamically.

---

# 27. Filters

The architecture should support future dynamic filters.

MVP filters may include:

```text
Category
Rating
Tags
```

Do not hardcode category-specific filters yet.

---

# 28. Tags

Create:

```text
tags
```

Fields:

```text
id
name
slug
description
status
created_at
```

Create junction table:

```text
entity_tags
```

Fields:

```text
entity_id
tag_id
```

Tags should be fully admin-managed.

---

# 29. Discussion

Each entity can have its own discussion section.

Do not build a general campus social feed in MVP.

Create:

```text
discussion_posts
```

Suggested fields:

```text
id
entity_id
user_id
parent_id nullable

body
status

created_at
updated_at
```

If:

```text
parent_id = null
```

the post is a new thread.

Otherwise it is a reply.

---

# 30. Campus Pulse

Campus Pulse is a lightweight engagement feature.

It allows students to answer quick questions.

The goal is:

```text
Low friction
+
Instant result
+
High participation
```

The concept comes from the product discussion where quick one-tap or swipe-based questions were proposed as an alternative to long surveys. 

---

# 31. Polls

Create:

```text
polls
```

Fields:

```text
id
school_id

question
description nullable

status

starts_at
ends_at

created_by
created_at
updated_at
```

---

# 32. Poll Options

Create:

```text
poll_options
```

Fields:

```text
id
poll_id

label
entity_id nullable

sort_order
created_at
```

An option may optionally reference an Entity.

This supports questions such as:

```text
Entity A
vs.
Entity B
```

without requiring hardcoded relationships.

---

# 33. Poll Votes

Create:

```text
poll_votes
```

Fields:

```text
id
poll_id
option_id
user_id
created_at
```

Constraint:

```text
UNIQUE(poll_id, user_id)
```

One authenticated user may vote once per poll.

---

# 34. Poll UI

The MVP may display:

```text
Campus Pulse

Option A
VS
Option B
```

After the user votes:

```text
Option A   56%
Option B   44%

438 votes
```

Always display sample size.

Never claim:

> “56% of all students think...”

Instead display:

> “56% of 438 participants”

---

# 35. What's Hot

The homepage may include:

```text
What's Hot
```

This section may display:

* most viewed entities
* most reviewed entities
* recently active discussions
* active polls

The content should be calculated from platform data.

Do not manually hardcode items.

---

# 36. Points System

Basic contribution points may be included as a P1 feature.

The system should not initially include real-money value or a reward marketplace.

Create:

```text
point_transactions
```

Fields:

```text
id
user_id
action_type
points

reference_type nullable
reference_id nullable

created_at
```

Examples of configurable actions:

```text
rating_submitted
review_submitted
poll_answered
edit_approved
```

The exact point values should be configuration-driven if implemented.

---

# 37. Reports

Create:

```text
reports
```

Fields:

```text
id
reporter_user_id

target_type
target_id

reason
details nullable

status

reviewed_by nullable
reviewed_at nullable

created_at
```

Possible targets:

```text
review
discussion_post
user
entity
```

---

# 38. Moderation

The platform must support moderation from the first public version.

Admins/moderators must be able to:

```text
View Reports
Hide Content
Restore Content
Resolve Reports
Suspend Users
```

Content rules should prohibit:

* harassment
* threats
* doxxing
* hate speech
* explicit sexual content
* violent content
* spam
* targeted personal attacks
* malicious repeated ratings

The team specifically identified malicious reviews, spam ratings, threats, and inappropriate content as possible failure modes during planning.  

---

# 39. Entity Suggestions

Users may suggest a missing entity.

Create:

```text
entity_suggestions
```

Suggested fields:

```text
id
user_id
school_id

suggested_name
suggested_category_id nullable
suggested_parent_entity_id nullable

description
source_url nullable

status

reviewed_by nullable
reviewed_at nullable

created_at
```

Admins can:

```text
Approve
Reject
Convert to Entity
```

---

# 40. Edit Suggestions

Users may suggest corrections to existing entities.

Create:

```text
edit_suggestions
```

Fields:

```text
id
entity_id
user_id

suggested_changes jsonb
evidence_url nullable

status

reviewed_by nullable
reviewed_at nullable

created_at
```

Users must never directly edit official entity records.

---

# 41. Admin Dashboard

The admin dashboard is a P0 requirement.

The UI does not need to be visually polished.

It must be functional.

---

# 42. Admin: School Management

Admin can:

```text
Create School
Edit School
Archive School
Configure Email Domain
```

---

# 43. Admin: Category Management

Admin can:

```text
Create Category
Edit Category
Archive Category
Reorder Categories
```

No category changes should require code modifications.

---

# 44. Admin: Rating Dimension Management

For each Category:

Admin can:

```text
Add Rating Dimension
Edit Rating Dimension
Disable Rating Dimension
Reorder Rating Dimensions
```

Example workflow:

```text
Admin
↓
Category
↓
Add Dimension
↓
Save
↓
Rating form updates automatically
```

This is a critical requirement.

---

# 45. Admin: Entity Management

Admin can:

```text
Create Entity
Edit Entity
Archive Entity
Assign Category
Assign Parent Entity
Assign School
Assign Tags
Edit Metadata
Edit Source Information
```

---

# 46. Bulk Data Import

Because real campus data will be added later, the platform should support importing data.

P1 requirement:

```text
CSV Import
```

Recommended CSV fields:

```text
name
category_slug
parent_slug
description
location_name
official_url
source_url
metadata
```

Import should:

```text
Validate
Preview
Import
Report Errors
```

Do not automatically overwrite existing records without confirmation.

---

# 47. Export

Admins should eventually be able to export:

```text
Entities
Reviews
Ratings
Poll Results
```

to CSV.

This is useful for:

* backups
* analysis
* migrations
* research

---

# 48. Homepage

Recommended homepage structure:

```text
Header

Search

Categories

Campus Pulse

Student-rated discoveries

Recent Reviews

Footer
```

All sections must gracefully handle an empty database.

---

# 49. Empty States

Because the application may initially contain little or no data, empty states are extremely important.

Examples:

```text
“No categories have been added yet.”
```

```text
“No reviews yet. Be the first to share your experience.”
```

```text
“No active polls right now.”
```

```text
“No results found.”
```

Do not show broken layouts when the database is empty.

---

# 50. Data-Free Development Requirement

Developers must be able to run the application with:

```text
0 schools
0 categories
0 entities
0 reviews
```

without errors.

The platform must remain functional.

This is a major requirement.

---

# 51. Optional Development Seed Data

Development environments may use fake data.

Example:

```text
Example University
Example Category
Example Location A
Example Location B
```

Do not use real Duke data as required application logic.

Seed data must be replaceable.

Production may start with an empty database.

---

# 52. Frontend Routes

Recommended routes:

```text
/
```

Homepage.

```text
/search
```

Search.

```text
/category/[slug]
```

Category browse page.

```text
/entity/[slug]
```

Entity detail page.

```text
/pulse
```

Polls.

```text
/login
```

Authentication.

```text
/profile
```

User profile.

```text
/admin
```

Admin dashboard.

---

# 53. Admin Routes

Recommended:

```text
/admin/schools
/admin/categories
/admin/entities
/admin/rating-dimensions
/admin/polls
/admin/reports
/admin/suggestions
/admin/users
```

---

# 54. Mobile First

The application must work well on:

```text
Mobile
Tablet
Desktop
```

Primary design target:

> Mobile-first responsive design.

Most campus usage is expected to occur on phones.

---

# 55. Visual Design

The MVP should prioritize:

```text
Clear
Fast
Modern
Minimal
Student-friendly
```

Avoid:

* excessive animations
* overly corporate design
* visual clutter
* complex dashboards for normal users

Suggested visual style:

```text
Clean cards
Rounded corners
Readable typography
Strong spacing
Simple icons
```

Support:

```text
Light Mode
Dark Mode
```

if easy to implement.

Dark mode is not P0.

---

# 56. Technical Stack

Recommended:

### Frontend

```text
Next.js
TypeScript
```

### Styling

```text
Tailwind CSS
```

### Components

```text
shadcn/ui
```

### Backend

```text
Supabase
```

### Database

```text
PostgreSQL
```

### Authentication

```text
Supabase Auth
```

### Deployment

```text
Vercel
```

### Analytics

```text
PostHog
```

---

# 57. Architecture

```text
Browser
   ↓
Next.js
   ↓
Supabase
   ├── Auth
   ├── PostgreSQL
   ├── RLS
   └── Storage
```

Do not introduce additional infrastructure without a clear requirement.

Do not add:

```text
MongoDB
Firebase
Redis
Elasticsearch
GraphQL
Microservices
Vector Database
```

during MVP unless specifically approved.

---

# 58. Database Rules

Use:

```text
UUID
```

for primary keys.

Important tables should include:

```text
created_at
updated_at
```

All database schema changes must use migrations.

Never rely on undocumented manual production database changes.

---

# 59. Row Level Security

Supabase RLS is mandatory.

Examples:

### Entities

```text
Public:
Read

User:
No direct write

Admin:
Create / Update / Archive
```

### Reviews

```text
Public:
Read approved reviews

Authenticated User:
Create own review
Edit own review
Delete own review

Other Users:
Cannot edit
```

### Admin Data

```text
Admin only
```

Frontend visibility must never be treated as authorization.

---

# 60. Input Validation

Validate input both:

```text
Client-side
Server-side / Database
```

Examples:

Rating values must stay inside configured range.

Review text should have maximum length.

Poll votes must reference valid poll options.

Foreign keys must be enforced.

---

# 61. Security Requirements

P0:

* RLS
* server-side authorization
* input validation
* rate limiting
* secure environment variables
* no secrets committed to Git
* spam controls
* moderation
* safe rendering of user content
* database backups

---

# 62. Analytics Events

Track:

```text
page_view
search
category_view
entity_view

login_started
login_completed

rating_started
rating_submitted

review_submitted
review_updated

helpful_clicked

discussion_created
discussion_replied

poll_viewed
poll_voted

report_submitted

entity_suggested
edit_suggested
```

---

# 63. Admin Analytics

The admin dashboard should eventually display:

```text
Total Users
Verified Users
Active Users

Total Entities
Total Ratings
Total Reviews

Reviews per Entity

Searches

Poll Participation

Reports Pending
```

P1 unless trivial to implement.

---

# 64. Performance

Basic target:

Public pages should feel fast on mobile.

Avoid excessive client-side fetching.

Use server rendering / caching where appropriate.

Do not prematurely optimize for millions of users.

---

# 65. Accessibility

Use:

* semantic HTML
* keyboard navigation
* form labels
* reasonable contrast
* accessible buttons
* accessible dialogs

Aim for basic WCAG-friendly behavior.

---

# 66. MVP Priority

## P0 — Build First

```text
Project setup
Database
Authentication
Schools
Categories
Entities
Rating dimensions
Search
Browse
Entity page
Ratings
Reviews
Admin dashboard
RLS
Reports
Moderation
Responsive design
```

---

## P1 — Build After Core Works

```text
Helpful votes
Entity discussion
Campus Pulse
What's Hot
Tags
CSV import
Edit suggestions
Entity suggestions
Analytics
```

---

## P2 — Later

```text
Points
Badges
QR campaigns
Campus activities
News integration
Referral system
```

---

## P3 — Future

```text
Native mobile apps
AI recommendations
Prediction features
Rewards marketplace
Multi-campus launch tools
Advanced personalization
Marketplace
```

---

# 67. Features Explicitly Out of Scope

Do NOT build during MVP:

* direct messaging
* follower system
* general anonymous feed
* rating individual students
* professor rating system
* marketplace
* payments
* real-money betting
* AI chatbot
* complex recommender system
* native mobile app
* advanced gamification

---

# 68. Required Vibe Coding Repository Structure

Recommended:

```text
/
├── app/
├── components/
├── lib/
├── types/
│
├── supabase/
│   ├── migrations/
│   └── seed/
│
├── docs/
│   ├── PRD.md
│   ├── DATABASE.md
│   ├── SECURITY.md
│   └── DESIGN.md
│
├── AGENTS.md
├── BACKLOG.md
│
├── .env.example
└── README.md
```

---

# 69. AI Coding Rules

Coding agents must follow these rules.

### Rule 1

Do not add features that are not defined in this PRD.

### Rule 2

Do not hardcode campus data.

### Rule 3

Do not hardcode categories.

### Rule 4

Do not hardcode rating dimensions.

### Rule 5

Database schema changes require migrations.

### Rule 6

Do not bypass RLS.

### Rule 7

Do not expose Supabase service-role keys.

### Rule 8

Do not replace existing architecture without explicit approval.

### Rule 9

Use TypeScript types.

Avoid unnecessary:

```typescript
any
```

### Rule 10

Prefer reusable generic components.

Example:

```text
EntityCard
RatingForm
ReviewCard
CategoryCard
PollCard
```

instead of:

```text
DormCard
RestaurantCard
LibraryCard
```

---

# 70. Most Important Engineering Principle

Prefer:

```text
Configuration
```

over:

```text
Conditional Code
```

Bad:

```typescript
if (category === "housing") {
   ...
}
```

Better:

```typescript
const dimensions =
  await getRatingDimensions(categoryId);
```

The goal is:

> **Adding a new category should usually require database configuration, not a frontend deployment.**

---

# 71. Acceptance Criteria: Dynamic Category

```text
GIVEN an admin creates a new category

AND adds three rating dimensions

AND creates an entity in that category

WHEN a user opens the entity page

THEN the page automatically displays those three rating dimensions

WITHOUT requiring a code change.
```

This is one of the most important MVP acceptance tests.

---

# 72. Acceptance Criteria: Empty Database

```text
GIVEN the application database contains no entities

WHEN a user opens the homepage

THEN the application loads successfully

AND displays appropriate empty states

AND no errors occur.
```

---

# 73. Acceptance Criteria: Rating

```text
GIVEN a verified user

WHEN they open an entity

AND submit valid ratings

THEN the rating is stored

AND included in the entity aggregates

AND the user cannot create a second independent rating for the same entity.
```

---

# 74. Acceptance Criteria: Anonymous Review

```text
GIVEN a verified user

WHEN they choose to post anonymously

THEN other users cannot see their account identity

BUT moderators and the platform can still associate the review with the authenticated user.
```

---

# 75. Acceptance Criteria: Admin Data Management

```text
GIVEN an admin

WHEN they create a school, category, rating dimensions, and entity

THEN the new entity becomes usable on the public website

WITHOUT editing source code.
```

---

# 76. Acceptance Criteria: Moderation

```text
GIVEN a user reports a review

WHEN a moderator opens the moderation dashboard

THEN the report appears in the moderation queue

AND the moderator can resolve the report

AND hide the reported content if necessary.
```

---

# 77. MVP Definition of Done

The MVP is considered complete when:

```text
The site works with an empty database.

Admins can create schools.

Admins can create categories.

Admins can create rating dimensions.

Admins can create entities.

Users can browse entities.

Users can search entities.

Users can view generic entity pages.

Users can authenticate.

Verified users can rate entities.

Verified users can write reviews.

Users can edit/delete their own reviews.

Users can report content.

Admins can moderate content.

All pages work on mobile and desktop.

All user-facing text is English.

No real campus data is required by the codebase.

No categories or rating dimensions are hardcoded.
```

At this point:

> **Stop adding major features and begin real-user testing.**

---

# 78. Final Product Architecture

```text
                    CAMPUS PLATFORM
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
         DISCOVER        RATE         ENGAGE
            │             │             │
         Search         Rating       Discussion
         Browse         Review       Campus Pulse
         Filter         Helpful      What's Hot
            │             │             │
            └─────────────┼─────────────┘
                          ▼
                    CAMPUS DATA
                          │
                          ▼
                     Admin CMS
                          │
             ┌────────────┼────────────┐
             ▼            ▼            ▼
         Categories     Entities    Rating Rules
```

The core philosophy is:

> **The website should be a configurable platform, not a Duke-specific collection of hardcoded pages.**

And the single most important implementation requirement is:

> **A non-technical administrator should eventually be able to add a completely new category and new rating objects through the admin dashboard without asking a developer to change the website.**

