begin;

create table public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  description text check (description is null or char_length(description) <= 1000),
  category text not null check (category in ('logo', 'icon', 'guideline', 'embroidery', 'font', 'other')),
  file_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  approved boolean not null default true,
  is_primary_logo boolean not null default false,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_primary_logo or (category = 'logo' and approved))
);

create unique index brand_assets_primary_logo_idx
  on public.brand_assets (organization_id)
  where is_primary_logo;
create index brand_assets_organization_idx
  on public.brand_assets (organization_id, category, created_at desc);

alter table public.brand_assets enable row level security;
revoke all on public.brand_assets from anon, authenticated;
grant select, insert, update, delete on public.brand_assets to authenticated;

create policy brand_assets_read on public.brand_assets
for select to authenticated using (
  private.is_org_admin(organization_id)
  or (approved and private.is_org_member(organization_id))
);

create policy brand_assets_admin_insert on public.brand_assets
for insert to authenticated with check (
  private.is_org_admin(organization_id)
  and uploaded_by = auth.uid()
  and file_path like organization_id::text || '/%'
);

create policy brand_assets_admin_update on public.brand_assets
for update to authenticated using (
  private.is_org_admin(organization_id)
) with check (
  private.is_org_admin(organization_id)
  and file_path like organization_id::text || '/%'
);

create policy brand_assets_admin_delete on public.brand_assets
for delete to authenticated using (
  private.is_org_admin(organization_id)
);

create table public.personal_library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_asset_id uuid references public.brand_assets(id) on delete cascade,
  template_id uuid references public.templates(id) on delete cascade,
  generated_asset_id uuid references public.generated_assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(brand_asset_id, template_id, generated_asset_id) = 1)
);

create unique index personal_library_brand_asset_idx
  on public.personal_library_items (user_id, brand_asset_id)
  where brand_asset_id is not null;
create unique index personal_library_template_idx
  on public.personal_library_items (user_id, template_id)
  where template_id is not null;
create unique index personal_library_generated_asset_idx
  on public.personal_library_items (user_id, generated_asset_id)
  where generated_asset_id is not null;
create index personal_library_user_created_idx
  on public.personal_library_items (user_id, created_at desc);

alter table public.personal_library_items enable row level security;
revoke all on public.personal_library_items from anon, authenticated;
grant select, insert, delete on public.personal_library_items to authenticated;

create policy personal_library_own_read on public.personal_library_items
for select to authenticated using (
  user_id = auth.uid()
  and private.is_org_member(organization_id)
);

create policy personal_library_own_insert on public.personal_library_items
for insert to authenticated with check (
  user_id = auth.uid()
  and private.is_org_member(organization_id)
  and (
    (brand_asset_id is not null and exists (
      select 1 from public.brand_assets asset
      where asset.id = personal_library_items.brand_asset_id
        and asset.organization_id = personal_library_items.organization_id
        and (asset.approved or private.is_org_admin(personal_library_items.organization_id))
    ))
    or (template_id is not null and exists (
      select 1 from public.templates template
      where template.id = personal_library_items.template_id
        and template.organization_id = personal_library_items.organization_id
        and (template.status = 'published' or private.is_org_admin(personal_library_items.organization_id))
    ))
    or (generated_asset_id is not null and exists (
      select 1 from public.generated_assets generated
      where generated.id = personal_library_items.generated_asset_id
        and generated.organization_id = personal_library_items.organization_id
        and generated.user_id = auth.uid()
    ))
  )
);

create policy personal_library_own_delete on public.personal_library_items
for delete to authenticated using (
  user_id = auth.uid()
);

create or replace function public.set_primary_brand_logo(p_asset_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.brand_assets;
begin
  select * into target
  from public.brand_assets
  where id = p_asset_id
  for update;

  if target.id is null
    or target.category <> 'logo'
    or not target.approved
    or not private.is_org_admin(target.organization_id) then
    raise exception 'An approved organization logo is required';
  end if;

  update public.brand_assets
  set is_primary_logo = false, updated_at = now()
  where organization_id = target.organization_id and is_primary_logo;

  update public.brand_assets
  set is_primary_logo = true, updated_at = now()
  where id = target.id;
end;
$$;

revoke all on function public.set_primary_brand_logo(uuid) from public, anon;
grant execute on function public.set_primary_brand_logo(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-library',
  'brand-library',
  false,
  52428800,
  array[
    'image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf',
    'application/postscript', 'application/illustrator', 'application/octet-stream',
    'font/ttf', 'font/otf', 'application/x-font-ttf', 'application/x-font-opentype'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy brand_library_files_read on storage.objects
for select to authenticated using (
  bucket_id = 'brand-library'
  and exists (
    select 1 from public.brand_assets asset
    where asset.file_path = name
      and (
        private.is_org_admin(asset.organization_id)
        or (asset.approved and private.is_org_member(asset.organization_id))
      )
  )
);

create policy brand_library_files_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'brand-library'
  and lower(storage.extension(name)) in ('png','jpg','jpeg','svg','pdf','eps','ai','dst','pes','exp','jef','ttf','otf')
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then private.is_org_admin(((storage.foldername(name))[1])::uuid)
    else false
  end
);

create policy brand_library_files_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'brand-library'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then private.is_org_admin(((storage.foldername(name))[1])::uuid)
    else false
  end
);

commit;
