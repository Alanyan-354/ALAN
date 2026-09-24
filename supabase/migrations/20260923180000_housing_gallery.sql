begin;

-- 300 Swift was supplied as a housing location but was not present in the
-- original Duke catalog. Add it through the same generic entity model.
insert into public.entities(
  school_id, category_id, name, slug, short_description, description,
  location_name, address, official_url, source_name, source_url, metadata,
  status, is_featured
)
select s.id, c.id, '300 Swift', '300-swift', 'A Duke housing location.',
  'A residential location in the Duke campus catalog.', 'Swift Avenue', '', '',
  'User-supplied campus housing collection', '', '{}'::jsonb, 'active', false
from public.schools s
join public.categories c on c.school_id = s.id and c.slug = 'housing'
where s.slug = 'duke-university'
on conflict(slug) do nothing;

do $$
begin
  if not exists (
    select 1 from public.entities e
    join public.schools s on s.id = e.school_id and s.slug = 'duke-university'
    join public.categories c on c.id = e.category_id and c.slug = 'housing'
    where e.slug = '300-swift'
  ) then
    raise exception 'The 300 Swift housing entity conflicts with an existing catalog slug.';
  end if;
end $$;

with source(slug, filename, alt) as (
 values
 ('alspaugh','01_Alspaugh.jpg','Alspaugh residence hall painted bench sign'),
 ('bassett','02_Bassett.jpg','Bassett residence hall painted bench sign'),
 ('bell-tower','03_BellTower.jpg','Bell Tower residence hall exterior'),
 ('blackwell','04_Blackwell.jpg','Blackwell residence hall exterior'),
 ('brown','05_Brown.jpg','Brown residence hall exterior'),
 ('east-house','06_EastHouse.jpg','East House painted bench sign'),
 ('gilbert-addoms','07_GilbertAddoms.jpg','Gilbert-Addoms residence hall exterior'),
 ('giles','08_Giles.jpg','Giles residence hall exterior'),
 ('pegram','09_Pegram.jpg','Pegram residence hall exterior'),
 ('randolph','10_Randolph.jpg','Randolph residence hall exterior'),
 ('southgate','11_Southgate.jpg','Southgate residence hall exterior'),
 ('west-house','12_WestHouse.jpg','West House residence hall exterior'),
 ('trinity','13_Trinity.jpg','Trinity residence hall exterior'),
 ('wilson','14_Wilson.jpg','Wilson residence hall exterior'),
 ('craven-quad','15_Craven.jpg','Craven Quad stone residence exterior'),
 ('crowell-quad','16_Crowell.jpg','Crowell Quad tower and entrance'),
 ('edens-quad','17_Edens.jpg','Edens Quad renovated courtyard entrance'),
 ('few-quad','18_Few.jpg','Few Quad Gothic stone arcade'),
 ('hollows-quad','19_Hollows.jpg','Hollows Quad residence buildings and courtyard'),
 ('keohane-quad','20_Keohane.jpg','Keohane Quad residence exterior and footbridge'),
 ('kilgo-quad','21_Kilgo.jpg','Kilgo Quad inner courtyard'),
 ('wannamaker-quad','22_Wannamaker.jpg','Wannamaker Quad renovated entrance at dusk'),
 ('300-swift','23_300Swift.jpg','300 Swift Avenue apartment building exterior')
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

commit;
