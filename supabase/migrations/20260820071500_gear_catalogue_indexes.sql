create index gear_catalog_items_category_owner_idx
  on public.gear_catalog_items (category_id, owner_id);
