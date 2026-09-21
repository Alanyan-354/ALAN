begin;

update public.rating_dimensions as dimension
set label='Meal Plan Value',updated_at=now()
from public.categories as category
where category.id=dimension.category_id
  and category.slug='dining'
  and dimension.key='value'
  and dimension.label is distinct from 'Meal Plan Value';

commit;
