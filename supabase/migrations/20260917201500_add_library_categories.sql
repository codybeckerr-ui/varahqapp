begin;

alter table public.brand_assets
  add column library_category text not null default 'General'
  check (char_length(trim(library_category)) between 1 and 80);

alter table public.templates
  add column library_category text not null default 'General'
  check (char_length(trim(library_category)) between 1 and 80);

update public.brand_assets
set library_category = case category
  when 'logo' then 'Logos'
  when 'icon' then 'Icons'
  when 'guideline' then 'Guides'
  when 'embroidery' then 'Embroidery'
  when 'font' then 'Fonts'
  else 'General'
end;

update public.templates
set library_category = case
  when lower(name) like '%business card%' or lower(name) like '%letterhead%' or lower(name) like '%email signature%' then 'Stationery'
  when lower(name) like '%social%' then 'Social'
  when lower(name) like '%sign%' or lower(name) like '%listing panel%' then 'Signage'
  when lower(name) like '%guide%' then 'Guides'
  when lower(name) like '%flyer%' or lower(name) like '%postcard%' or lower(name) like '%brochure%' then 'Print & Mail'
  else 'General'
end;

create index brand_assets_library_category_idx
  on public.brand_assets (organization_id, library_category);
create index templates_library_category_idx
  on public.templates (organization_id, library_category)
  where status = 'published';

grant update(library_category) on public.templates to authenticated;

commit;
