drop policy if exists brand_library_files_read on storage.objects;

create policy brand_library_files_read on storage.objects
for select to authenticated using (
  bucket_id = 'brand-library'
  and exists (
    select 1 from public.brand_assets asset
    where asset.file_path = storage.objects.name
      and (
        private.is_org_admin(asset.organization_id)
        or (asset.approved and private.is_org_member(asset.organization_id))
      )
  )
);
