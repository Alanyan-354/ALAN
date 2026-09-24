-- Curated, optional images for the Duke dining catalog. The page remains data-driven:
-- future entities can set metadata.gallery from the existing admin JSON editor.
with source(slug, position, filename, kind, alt) as (
 values
 ('brodhead-center',1,'brodhead-exterior.jpg','photo','Brodhead Center exterior at dusk'),
 ('bryan-center',1,'bryan-center.jpg','photo','Dining area inside Bryan Center'),
 ('marketplace',1,'marketplace-dining.jpg','photo','Marketplace dining counters'),
 ('gardens-cafe',1,'gardens-cafe.jpg','photo','Gardens Cafe counter'),
 ('farmstead',1,'farmstead-logo.jpg','graphic','Farmstead Garden Market logo'),
 ('farmstead',2,'farmstead-feature.jpg','graphic','Farmstead featured dining graphic; offerings may have changed'),
 ('ginger-soy',1,'ginger-soy-team.jpg','photo','Ginger + Soy kitchen team'),
 ('ginger-soy',2,'ginger-soy-logo.jpg','graphic','Ginger + Soy logo'),
 ('gyotaku',1,'gyotaku-feature.jpg','graphic','Gyotaku featured dining graphic; offerings may have changed'),
 ('il-forno',1,'il-forno-dining.jpg','photo','Il Forno dining area in Brodhead Center'),
 ('il-forno',2,'il-forno-logo.jpg','graphic','Il Forno Italian Kitchen logo'),
 ('jbs-roasts-and-chops',1,'jbs-logo.jpg','graphic','JB''s Roasts & Chops logo'),
 ('sazon',1,'sazon-logo.jpg','graphic','Sazón Latin American Table logo'),
 ('sazon',2,'sazon-feature.jpg','graphic','Sazón featured dining graphic; offerings may have changed'),
 ('sprout',1,'sprout-logo.jpg','graphic','Sprout logo'),
 ('tandoor',1,'tandoor-logo.jpg','graphic','Tandoor logo'),
 ('tandoor',2,'tandoor-feature.jpg','graphic','Tandoor featured dining graphic; offerings may have changed'),
 ('the-chefs-kitchen',1,'chefs-kitchen.jpg','photo','Chef preparing food at The Chef''s Kitchen'),
 ('the-commons',1,'commons-interior.png','photo','Dining room at The Commons'),
 ('the-commons',2,'commons-dish.jpg','photo','Plate served at The Commons'),
 ('the-devils-krafthouse',1,'devils-krafthouse-logo.jpg','graphic','The Devil''s Krafthouse logo'),
 ('the-devils-krafthouse',2,'devils-krafthouse-feature.jpg','graphic','The Devil''s Krafthouse featured dining graphic; offerings may have changed'),
 ('the-skillet',1,'skillet-kitchen.jpg','photo','Food preparation at The Skillet'),
 ('the-skillet',2,'skillet-logo.jpg','graphic','The Skillet Southern Cookery logo'),
 ('beyu-blue-coffee',1,'beyu-blue-coffee.jpg','photo','Beyu Blue Coffee drinks'),
 ('gothic-grill',1,'gothic-grill-opening.jpg','photo','Gothic Grill opening inside Bryan Center'),
 ('gothic-grill',2,'gothic-grill-feature.jpg','graphic','Gothic Grill featured dining graphic; offerings may have changed'),
 ('red-mango',1,'red-mango-feature.jpg','graphic','Red Mango featured dining graphic; offerings may have changed'),
 ('saladelia-at-sanford',1,'saladelia-logo.jpg','graphic','Saladelia logo'),
 ('saladelia-at-perkins-library',1,'saladelia-logo.jpg','graphic','Saladelia logo')
), galleries as (
 select slug, jsonb_agg(jsonb_build_object('src','/dining-gallery/' || filename,'alt',alt,'kind',kind) order by position) as images
 from source group by slug
)
update public.entities e
set metadata = coalesce(e.metadata, '{}'::jsonb) || jsonb_build_object('gallery', g.images)
from galleries g, public.categories c, public.schools s
where e.slug = g.slug and e.category_id = c.id and c.slug = 'dining'
  and e.school_id = s.id and s.slug = 'duke-university'
  and not (coalesce(e.metadata, '{}'::jsonb) ? 'gallery');
