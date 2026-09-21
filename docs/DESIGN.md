---
name: RATEDUKE
description: An English-only blue and white campus guide.
colors:
  ink: "#172641"
  muted: "#62708a"
  blue: "#2854eb"
  blue-dark: "#1e41bd"
  line: "#e2e7ef"
  canvas: "#f7f9fc"
  white: "#ffffff"
  placeholder: "#626f85"
  verified: "#487150"
  category-blue-bg: "#eaf0ff"
  category-blue-ink: "#4264c9"
  category-green-bg: "#e8f0e9"
  category-green-ink: "#537b57"
  category-ochre-bg: "#f7eddc"
  category-ochre-ink: "#815715"
  category-purple-bg: "#f1eaf8"
  category-purple-ink: "#775296"
  demo-bg: "#edf2fc"
  demo-ink: "#42577f"
  forum-muted: "#586b8b"
  forum-muted-button: "#566680"
  forum-muted-action: "#6c7890"
  forum-muted-tombstone: "#7a8496"
  forum-muted-control: "#687791"
  forum-link: "#53698f"
  forum-copy: "#42506a"
  forum-copy-strong: "#39475f"
  forum-soft: "#e9edf4"
  forum-border-strong: "#cfd8e8"
  forum-hover-border: "#9aafe9"
  forum-upload-border: "#9caed2"
  forum-drag: "#99a4b7"
  forum-thread: "#6077a4"
  forum-danger: "#9b3530"
  forum-danger-bg: "#fff2f1"
  forum-success: "#467058"
  forum-shadow-10: "rgba(29,56,111,.10)"
  forum-shadow-15: "rgba(29,56,111,.15)"
typography:
  display:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "55px"
    fontWeight: 800
    lineHeight: 1.14
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "16px"
    lineHeight: 1.6
  scale: ["10px", "11px", "12px", "13px", "14px", "15px", "16px", "20px", "22px", "29px", "30px", "34px", "35px", "36px", "46px", "55px"]
rounded:
  field: "7px"
  button: "8px"
  search: "10px"
  tile: "12px"
  card: "14px"
  forum-compact: "9px"
  forum-card-mobile: "11px"
  forum-gallery: "16px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.white}"
    rounded: "{rounded.button}"
    padding: "11px 19px"
  button-primary-hover:
    backgroundColor: "{colors.blue-dark}"
  entity-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
---

# Design System: RATEDUKE

## Overview

**Creative North Star: "Blue and white campus guide"**

Mode: Operate. This records the user-approved, code-led implementation; no raster composition is the design authority. Clear English, visible search, and readable resource and review content serve students on phones and administrators configuring campus information.

**Key Characteristics:**

- Navy headings, royal-blue actions, white surfaces, and a pale blue-gray canvas.
- Manrope variable typography and consistent outline icons.
- Data-driven category treatments and responsive stacked content.

Source: `app/globals.css`, `app/pulse.css`, `app/forum.css` and typed components. Forum uses the same blue/white world as a photo-led campus field-notes wall. `.impeccable/design.json` carries preview snippets and extensions.

## Colors

### Primary

Royal blue identifies primary actions, links, and focus; deeper blue marks primary-button hover. Navy carries headings and primary text.

### Secondary

Category illustrations pair pale blue, green, ochre, or purple surfaces with their darker ink. These treatments follow category sort order, with no fixed meaning for named categories. Verification uses muted green alongside a badge and text. Ratings use a bold tabular score out of ten and a ten-segment half-fill meter; five-star imagery is not used.

### Neutral

White navigation and cards sit on the canvas with single light borders. Muted text and darker placeholders keep secondary information readable. Preserve the reviewed accessible foreground/background pairs, including white text on blue empty-state buttons.

## Typography

Manrope Variable loads locally through `@fontsource-variable/manrope`, with a sans-serif fallback. Body and principal descriptive copy use 16px, secondary information commonly uses 14px, and supporting labels use 12px. The compact BETA brand marker uses 10px. UI and errors remain English.

Headings have tight tracking and bold variable weights. Discovery display text scales to 48px at 1100px and below, 44px at 760px and below, and 60px from 1500px. Section, entity, and admin headings use contextual sizes. Rating summaries use large tabular numerals.

## Layout

Header, main content, and footer share a centered container (1256px maximum, 40px side padding); the maximum becomes 1310px from 1500px. Side padding reduces to 28px at 1100px and 20px at 760px. Desktop discovery pairs a main column with a quieter guidance panel, four category columns, and three resource columns.

At 1100px, categories become two columns and reviews stack. At 760px, resource cards, detail content, profiles, login, and forms stack. The detail rating summary precedes descriptive content. Category tiles retain two columns, with icons above labels. The header switches to a menu; admin navigation becomes a horizontally scrollable row and wide tables scroll inside their container. Supporting guidance panels hide on phones.

The development-only **Fictional demo** strip occupies normal document flow directly below the header. Expanded controls open beneath it. The collapsed strip stays clear of campus content and actions at every viewport.

## Elevation & Depth

Borders and pale tonal surfaces provide most separation. Resource cards are flat at rest; Quick Choice has a persistent soft shadow and its popup has stronger elevation. Resource-card hover changes the border and lifts the card 3px. Most state transitions last 150–180ms; the popup entrance lasts 320ms and result bars reveal over 450ms. Reduced-motion preference disables these animations, transitions, smooth scrolling, and card lift.

## Shapes

Gently rounded rectangles follow the card, tile, search, button, and field radii in the frontmatter. Review avatars are circles; dimension chips have 4px corners. Lucide icons share a 1.75px stroke. Icon-led category bands provide resource-card imagery.

## Components

- **Buttons:** blue primary, white bordered secondary, transparent ghost, and pale red destructive variants. Standard controls have a 44px minimum height; compact and header variants are smaller. Focus uses a visible blue outline with offset.
- **Search and fields:** white surfaces, clear labels, dark placeholders, and blue focus treatment. Mobile form inputs use 16px text. Help and error messages stay in flow.
- **Discover and entity cards:** names, icons, counts, and content come from configured data. Unknown icon names fall back to Compass; four color treatments cycle by sort order. Student-submitted entities use their approved photo. Cards show location, description, a descriptive overall score or Not rated state, rating count, and a View ratings action. Discover uses direct database-driven category tabs and supports Recommended, Highest Rated, Most Rated, and Recently Reviewed sorting without assigning ranks.
- **Reviews and ratings:** public identity, verification, date, bold numeric score, ten-segment meter, optional text, and wrapping dimension chips. Every score uses 1.0–10.0 in half-point steps. Summary bars accompany values and sample information.
- **Community submissions:** the submission form is a dedicated task surface. Pending and rejected images remain private; admin review pairs the image with the submitted facts and explicit approval/rejection actions. Profile history keeps status and feedback visible.
- **Navigation:** white header, blue brand icon, Forum, Discover, Campus Pulse, Account, and conditional Admin access. Admin selection uses pale blue fill and darker blue text. A keyboard skip link precedes the header.
- **Forum:** DOM order remains reading order while JavaScript grid-row measurement creates a four/three/two/one-column masonry layout. Cards are image-forward and flat. Detail uses a sticky gallery beside the story and conversation on desktop, then stacks on phones. Reply indentation stops after three levels and a connecting line plus “Replying to” preserves deeper context. The composer provides drag ordering and equivalent keyboard buttons.
- **Empty states:** centered icon, heading, explanation, and an appropriate action in a lightly dashed container. Primary CTA text stays white and legible.
- **Campus Pulse:** one Quick Choice card serves Predictions, Student Stats and the browsing prompt. Large choices use two columns on desktop and one on phones. Total participation remains visible before answering; per-option bars, percentages and counts are gated. Blue selection and green resolved-result treatments are reinforced by Your choice / Result text and icons. The prompt is a modal dialog with a dimmed backdrop, bottom-right desktop placement and mobile bottom sheet. Escape, backdrop and close controls dismiss it; keyboard focus stays inside while open and returns afterward. Dashboard stories always come from response aggregates.

## Do's and Don'ts

- **Do** preserve the English-only campus-guide direction and component hierarchy.
- **Do** retain visible focus, readable contrast, reduced-motion behavior, and responsive content order.
- **Do** derive category names, icons, entities, and rating dimensions from configured data.
- **Don't** introduce stock or invented campus photography into the icon-led system.
- **Don't** turn the Fictional demo strip into a fixed overlay or display demo controls in production.
