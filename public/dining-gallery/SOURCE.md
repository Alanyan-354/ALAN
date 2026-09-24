# Dining gallery assets

Assignments are data in `supabase/seed/dining-gallery.ts` and the two dining gallery migration files. Pages accept the same `metadata.gallery` shape for any entity. Photos and graphics do not establish current menus or hours.

## User-supplied images

The original 30 assets came from the images attached in this conversation. A venue check against Duke's published captions identified two additional supplied photos: `bella-union.jpg` (attachment 4, [Duke Today](https://today.duke.edu/2019/11/find-campus-dining-spot)) and `trinity-cafe.jpg` (attachment 32, [Duke Dining](https://students.duke.edu/living/dining/dining-locations/)). The former `brodhead-terrace.jpg` (attachment 12) was moved to `zwelis-terrace.jpg`: [Duke Today identifies the terrace as outside Zweli's Café](https://today.duke.edu/2022/03/your-spring-guide-outdoor-campus-spots). It is no longer assigned to Brodhead Center. The Marketplace servery photo also appears on [Duke Dining's locations page](https://students.duke.edu/living/dining/dining-locations/).

The other supplied images without a confirmed venue (attachments 3, 16, 21, 29 and 36) remain unassigned. Saladelia's supplied logo is shared by its two listed locations.

## Additional sourced images

| File | Subject and source |
| --- | --- |
| `bseisu-coffee-bar.jpg` | Espresso being prepared at Bseisu; [Duke Today](https://today.duke.edu/2025/09/brewing-community-one-cup-time-duke), photo by Travis Stanley. |
| `cafe-300.jpg` | The 300 Swift building, *not* the café interior; [Duke Today](https://today.duke.edu/2017/01/duke-purchases-300-swift-residential-building). [Duke Housing](https://students.duke.edu/living/housing/upperclass-housing/quad-descriptions/) places Café 300 on its main floor. |
| `freeman-center-cafe.jpg` | Service counter; [Duke Jewish Life](https://students.duke.edu/belonging/icr/jewishlife/kosher-dining/freeman-center-cafe/). |
| `nasher-cafe.jpg` | Café seating; [Nasher Café operator](https://www.giorgiosgroup.com/location/nasher-museum-cafe/). |
| `pitchforks.jpg` | Duke Pitchfork Café interior; [Armstrong Ceilings project gallery](https://www.armstrongceilings.com/commercial/en/photos-videos/project-gallery/gallery/669950.html). |
| `daily-docket.png` | Promotional café food image from [The Daily Docket's site](https://dukedailydocket.com/); it is not presented as a photograph of the actual counter. |
| `duke-cafe.jpg` | Gelato advertised by Duke Café's [operator](https://tayyebhospitality.com/). |
| `its-thyme-interior.jpg` | Interior from [It's Thyme's site](https://itsthymecafe.com/). |
| `twinnies.jpg` | Café entrance; [Duke Pratt](https://pratt.duke.edu/news/dukengineer-2022-twinnies/). |
| `wood-fired.jpg` | Pizza from Marketplace's wood-fired oven; [Duke Today](https://today.duke.edu/2016/04/foodies). This is a historical photo, not a current menu claim. |
| `alchemy.png` | Gothic Grill branding from the [Gothic Grill and Alchemy operator](https://www.thrivedurham.com/gothic-grill); it is a parent-venue graphic, not a photo of the bar. |

Where no reliable individual-counter photo was found, `panera-bread` and `the-sub-central` use the supplied Brodhead Center exterior, `mcdonalds` uses the supplied Bryan Center photo, and seven Marketplace counters use the supplied Marketplace servery photo. Their alt text and gallery captions explicitly identify the *parent venue*. Wood-Fired uses its own photo. These are location context, not depictions of the named counters.

The external images are credited here for provenance; copyright stays with their respective owners. Confirm reuse permission before publishing the bundled copies beyond this local project.

For a new entity, an administrator can add `gallery` in its existing metadata JSON editor as an ordered array of `{ "src": "/path/to/image.jpg", "alt": "Description", "kind": "photo" }` entries. `kind` can be `photo` or `graphic`. No page-component change is needed.
