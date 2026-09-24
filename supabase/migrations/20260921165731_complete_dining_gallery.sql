-- Correct a misidentified terrace photograph from the first gallery import.
update public.entities e
set metadata = jsonb_set(
  e.metadata,
  '{gallery}',
  (select coalesce(jsonb_agg(item order by ord), '[]'::jsonb)
   from jsonb_array_elements(e.metadata->'gallery') with ordinality as image(item, ord)
   where item->>'src' <> '/dining-gallery/brodhead-terrace.jpg')
)
from public.categories c, public.schools s
where e.slug = 'brodhead-center' and e.category_id = c.id and c.slug = 'dining'
  and e.school_id = s.id and s.slug = 'duke-university'
  and jsonb_typeof(e.metadata->'gallery') = 'array'
  and e.metadata->'gallery' @> '[{"src":"/dining-gallery/brodhead-terrace.jpg"}]'::jsonb;

-- Optional catalog photos. Shared building/servery images explicitly describe
-- the parent setting rather than claiming to depict the individual counter.
with source(slug, filename, kind, alt) as (
 values
 ('bella-union','bella-union.jpg','photo','Coffee counter and seating at Bella Union'),
 ('bseisu-coffee-bar','bseisu-coffee-bar.jpg','photo','Espresso being prepared at Bseisu Coffee Bar'),
 ('cafe-300','cafe-300.jpg','photo','300 Swift Avenue building, home of Café 300'),
 ('freeman-center-cafe','freeman-center-cafe.jpg','photo','Service counter at Freeman Center Café'),
 ('nasher-cafe','nasher-cafe.jpg','photo','Dining at the Nasher Museum Café'),
 ('pitchforks','pitchforks.jpg','photo','Interior of Duke''s Pitchfork Café'),
 ('the-daily-docket','daily-docket.png','photo','The Daily Docket café promotional food photograph'),
 ('trinity-cafe','trinity-cafe.jpg','photo','Counter and seating at Trinity Café'),
 ('twinnies','twinnies.jpg','photo','Twinnie''s Café entrance and counter'),
 ('zwelis','zwelis-terrace.jpg','photo','Outdoor seating beside Zweli''s Café at Duke Divinity'),
 ('brodhead-center-cafe','duke-cafe.jpg','photo','Gelato featured by Duke Café in the Brodhead Center'),
 ('panera-bread','brodhead-exterior.jpg','photo','Brodhead Center, home of the Panera Bread location'),
 ('the-sub-central','brodhead-exterior.jpg','photo','Brodhead Center, home of The Sub Central'),
 ('its-thyme','its-thyme-interior.jpg','photo','Interior of It''s Thyme in the Bryan Center'),
 ('mcdonalds','bryan-center.jpg','photo','Bryan Center dining area, home of the McDonald''s location'),
 ('alchemy','alchemy.png','graphic','Gothic Grill branding; Alchemy is its bar in the Bryan Center'),
 ('1892-grille','marketplace-dining.jpg','photo','Marketplace servery, home of 1892 Grille'),
 ('bakers-table','marketplace-dining.jpg','photo','Marketplace servery, home of Baker''s Table'),
 ('marketplace-cucina','marketplace-dining.jpg','photo','Marketplace servery, home of Cucina'),
 ('durham-market','marketplace-dining.jpg','photo','Marketplace servery, home of Durham Market'),
 ('marketplace-fusion','marketplace-dining.jpg','photo','Marketplace servery, home of Fusion'),
 ('marketplace-harvest','marketplace-dining.jpg','photo','Marketplace servery, home of Harvest'),
 ('leaf-and-ladle','marketplace-dining.jpg','photo','Marketplace servery, home of Leaf & Ladle'),
 ('marketplace-wood-fired','wood-fired.jpg','photo','Pizza served from a wood-fired oven at Marketplace')
)
update public.entities e
set metadata = coalesce(e.metadata, '{}'::jsonb) || jsonb_build_object(
  'gallery', jsonb_build_array(jsonb_build_object(
    'src', '/dining-gallery/' || source.filename,
    'alt', source.alt,
    'kind', source.kind
  ))
)
from source, public.categories c, public.schools s
where e.slug = source.slug and e.category_id = c.id and c.slug = 'dining'
  and e.school_id = s.id and s.slug = 'duke-university'
  and not (coalesce(e.metadata, '{}'::jsonb) ? 'gallery');
