-- Child housing units share a contextual photograph with their parent Quad.
-- Captions name the parent setting rather than claiming a unit-specific view.
with source(slug, filename, alt) as (
 values
 ('edens-1a','17_Edens.jpg','Edens Quad courtyard, home of Edens 1A'),
 ('edens-1b','17_Edens.jpg','Edens Quad courtyard, home of Edens 1B'),
 ('edens-1c','17_Edens.jpg','Edens Quad courtyard, home of Edens 1C'),
 ('edens-2a','17_Edens.jpg','Edens Quad courtyard, home of Edens 2A'),
 ('edens-2c','17_Edens.jpg','Edens Quad courtyard, home of Edens 2C'),
 ('edens-3a','17_Edens.jpg','Edens Quad courtyard, home of Edens 3A'),
 ('edens-3b','17_Edens.jpg','Edens Quad courtyard, home of Edens 3B'),
 ('hollows-a','19_Hollows.jpg','Hollows Quad residence buildings, home of Hollows A'),
 ('hollows-b','19_Hollows.jpg','Hollows Quad residence buildings, home of Hollows B'),
 ('keohane-abd','20_Keohane.jpg','Keohane Quad residence exterior, home of Keohane ABD'),
 ('keohane-e','20_Keohane.jpg','Keohane Quad residence exterior, home of Keohane E')
)
update public.entities e
set metadata = jsonb_set(
  coalesce(e.metadata, '{}'::jsonb),
  '{gallery}',
  jsonb_build_array(jsonb_build_object(
    'src', '/housing-gallery/' || source.filename,
    'alt', source.alt,
    'kind', 'photo'
  )),
  true
)
from source, public.categories c, public.schools s
where e.slug = source.slug
  and e.category_id = c.id and c.slug = 'housing'
  and e.school_id = s.id and s.slug = 'duke-university';
