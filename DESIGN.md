---
name: RATEDUKE
description: A restrained, modern blue-and-white campus discovery interface.
colors:
  blue: "#214fc6"
  blue-dark: "#173d9c"
  ink: "#182338"
  muted: "#5c687a"
  line: "#e0e5ed"
  canvas: "#fafbfc"
  surface: "#fff"
  surface-subtle: "#f1f4f8"
  surface-blue: "#edf3ff"
  border-strong: "#b8c3d2"
  danger: "#a3293d"
  success: "#246544"
typography:
  display:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "clamp(28px,3vw,38px)"
    fontWeight: 780
    lineHeight: 1.2
    letterSpacing: "-.035em"
  headline:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2.25rem)"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "-.025em"
  title:
    fontSize: "1.375rem"
    fontWeight: 750
    lineHeight: 1.35
  body:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.6
  label:
    fontSize: ".875rem"
    fontWeight: 650
rounded:
  small: "8px"
  control: "10px"
  surface: "16px"
  pill: "999px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "20px"
  space-6: "24px"
  space-8: "32px"
  space-10: "40px"
  space-12: "48px"
  space-16: "64px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.blue-dark}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  button-ghost:
    backgroundColor: "transparent"
    rounded: "{rounded.control}"
  entity-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
  search-field:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
    padding: "6px 6px 6px 16px"
---

# Design System: RATEDUKE

## Overview

**Creative North Star: "The everyday campus guide"**

The implemented direction is restrained modern consumer discovery: a white/light identity, Duke-inspired blue accents, readable Manrope typography, useful photography, and clear interactions. It serves students browsing on phones between campus activities. Blue creates emphasis and selected states; white surfaces keep resource names, reviews, and comparison data prominent.

This is an incremental visual system over existing feature layouts. Shared tokens live in `app/design-system.css`; Discover composition lives in `components/discovery.module.css` and the image-led listing primitive in `components/entity-card.module.css`. Preview evidence is from demo mode; live Supabase behavior was not verified.

The second iteration replaces the stacked Discover controls with a responsive title/search header, underlined category navigation and a native filter disclosure. Listing cards use an unboxed composition: rounded photograph, title and score on one row, then location and supporting metadata. Detail galleries precede the overview and review sections, including on mobile. Data, routes and contribution permissions remain unchanged.

**Key Characteristics:**

- White surfaces, a near-white canvas, and restrained blue accents.
- Compact discovery content and honest entity imagery.
- Shared controls, clear route states, and mobile bottom navigation.
- Generic components driven by school, category, entity, and dimension data.

## Colors

### Primary

The `blue` token is the campus accent for primary actions, active navigation, links, focus indicators, rating bars, and category symbols. `blue-dark` provides primary button hover feedback; `surface-blue` supplies the quiet selected or supporting fill. This is the current app palette, not a claim of exact official Duke brand color matching.

### Neutral

`surface` is the white card, header, and control background. `canvas` distinguishes the page from these surfaces without introducing a dark theme. `surface-subtle` groups supporting information; `ink` and `muted` separate primary content from metadata. `line` is a quiet divider; `border-strong` distinguishes editable controls and hovered cards. `danger` and `success` retain semantic feedback rather than introducing decorative accents.

**The Light Identity Rule.** Keep the existing `color-scheme: light`; the current system has no implemented dark theme.

## Typography

All content uses the existing locally bundled `Manrope Variable` with a sans-serif fallback. It is loaded by `app/layout.tsx`; do not add a second display family. Variable weights provide hierarchy without changing the friendly, practical character.

The frontmatter captures the desktop display and base heading roles. Page headings use a slightly tighter tracking override and line-height of 1.25. Smaller text tokens are `text-xs` (0.75rem), `text-sm` (0.875rem), and `text-lg` (1.125rem). Labels and metadata remain sentence case. Entity names use the large text token; explanatory and review text generally use the small token with generous line-height. Paragraph introductions are limited to roughly 62–65 characters per line where implemented.

At mobile widths the discovery headline is 29px, its secondary line is 19px, and entity headings are 28px. Inputs remain 16px for comfortable phone entry. Scores use tabular-looking numeric emphasis through weight and size; no separate numeric font is introduced.

## Layout

The shared page, header, and footer container is capped at 1200px, with gutters `clamp(20px, 4vw, 40px)`. Spacing follows the frontmatter's four-pixel rhythm. Sections generally have 40px vertical margins, reduced to 32px on mobile. Cards have 20px body padding, reduced to 16px on mobile.

| Viewport | Entity grid | Navigation and detail behavior |
| --- | --- | --- |
| Up to 479px | One column; image ratio 16:9 | Bottom navigation; single-column rating breakdown |
| 480–767px | Two columns; image ratio 4:3 | Bottom navigation; gallery precedes main content |
| 768–1023px | Two columns | Desktop navigation; 280px detail sidebar |
| 1024px and above | Three columns | Desktop navigation; 320px detail sidebar |

The sticky desktop header is 72px tall. At 767px and below it becomes 64px tall, the desktop links hide, and fixed bottom navigation appears. Bottom padding includes `env(safe-area-inset-bottom)` so page content clears the navigation. Category tiles become a horizontally scrollable, softly snapping row; filters remain compact. Desktop detail summaries stick below the header at 96px. Review grids collapse to one column at 1023px and below.

### Incremental stylesheet compatibility

Preserve the import order in `app/layout.tsx`: Manrope font CSS, `globals.css`, `forum.css`, then `design-system.css`. Inside `globals.css`, Tailwind is imported before `pulse.css`, followed by the existing global and feature rules. The final design stylesheet overrides visual tokens and selected responsive rules while retaining legacy gallery, admin, moderation, profile, and form structures. It is not a standalone replacement for the earlier files. Unoverridden feature-specific and higher-specificity rules remain active; validate affected screens in the actual cascade before removing old declarations.

## Elevation & Depth

Surfaces are mostly flat, separated by white, quiet fills, and one-pixel borders. Search receives the small shadow (`0 2px 8px rgb(24 35 56 / 5%)`); school and demo popovers use `0 12px 32px rgb(24 35 56 / 12%)`. Mobile navigation has a subtle upward shadow. Listing cards have no border or resting shadow; their image scales subtly on hover and dims on press. Forum cards retain a 2px hover lift.

Navigation, popover, and modal layer tokens are 30, 40, and 80 respectively. Buttons transition for 160ms using `cubic-bezier(.2,.8,.2,1)`. Existing card transitions remain inherited. Reduced-motion preferences disable animation, transitions, smooth scrolling, and hover translation.

## Shapes

The radius family is intentionally small: small chips, control corners, larger surfaces, and pill-shaped category tabs or school selectors. Rounded surfaces clip entity images. Real photos use `object-fit: cover`; graphic covers use `contain` with padding. Missing photos use a category icon and label on pale blue. Do not fabricate an image or imply a different entity identity to fill the slot.

## Components

### Buttons and fields

Keep the existing Radix Slot/CVA `Button` API: default, outline, ghost, and destructive variants, plus default, small, and icon sizes. Standard buttons and editable fields use 44px minimum height; small buttons and the mobile header action use 40px. These are implementation details, not a claim that every secondary action meets a 44px target. Primary buttons darken on hover; outline and ghost buttons receive a subtle fill. Enabled buttons move down 1px while pressed. Disabled buttons show a not-allowed cursor and reduced opacity, except completed Pulse choices retain legibility with full opacity.

`SearchField` is a shared GET form with a search landmark, a real visually hidden label, a search input, and a hidden school parameter. It preserves server-rendered navigation and school scope. The search container provides focus-within feedback: blue border and a 2px outline. Standard keyboard focus uses a 3px blue outline with a 3px offset. Field labels, errors, notices, and helper text stay in English; keep existing validation semantics.

### Navigation

`Navigation` shares route detection and school-scoped links between desktop and mobile. Active links have `aria-current="page"`, blue text, and a pale blue background. Icons are decorative and hidden from assistive technology. Mobile adds an Account destination; Admin appears only for staff. Bottom navigation items combine an icon with a visible label and a 52px minimum height. Keep the existing keyboard skip link and English document language.

### Cards and rating information

Entity cards are full-card links with a cover, title and score row, location, short description, then category and sample-count footer. Covers come from entity metadata; category icons and names come from configuration. Descriptions clamp to two lines. Ratings retain their actual sample count and empty-data meaning. Review cards use the same white bordered surface, with compact author metadata, verified status, readable body copy, and quiet dimension chips. Dimension labels and values remain data-driven.

### Tabs, chips, and Pulse

Discover categories use an underlined active state; rating and sorting controls live in a native disclosure with an active-filter count. Supporting dimension and status chips use smaller corners and subtle neutral fill. Pulse tabs indicate selection with blue text and an inset underline. Choice cards use quiet borders; selection adds pale blue without decorative shadows. Preserve the existing choice/result logic and data contracts.

### Empty, loading, and recovery states

`EmptyState` uses a decorative compass, a clear heading, optional explanatory body, and caller-supplied actions. White bordered surfaces, not error-red treatments, are the default for empty results. Loading uses neutral skeleton blocks matching title, search, and card proportions. Configuration and recoverable-error screens use the same restrained surface and existing recovery controls. Visual consistency must not hide configuration failures or replace real data with a successful-looking empty state.

## Do's and Don'ts

- **Do** reuse the shared Manrope, Button, Navigation, SearchField, EmptyState, and card components.
- **Do** preserve school scope, configuration-driven labels, existing galleries, keyboard focus, and reduced-motion behavior.
- **Do** inspect mobile and desktop output after changing the stylesheet cascade.
- **Do** keep demo preview evidence separate from live Supabase verification.
- **Don't** hardcode campus entities, categories, or rating dimensions into page components.
- **Don't** replace the white/light identity with a dark theme or add generated imagery to this refresh.
- **Don't** change backend behavior, identity redaction, permissions, or gallery seed data as a visual styling shortcut.
- **Don't** remove legacy styles wholesale; migrate and verify feature layouts incrementally.
