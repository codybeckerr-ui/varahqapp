begin;

-- Qualify the outer storage object path inside correlated subqueries. Without
-- the qualification, PostgreSQL resolves `name` to the inner table alias,
-- comparing brand_assets.file_path to brand_assets.name and hiding valid files.
alter policy brand_library_files_read on storage.objects
  using (
    bucket_id = 'brand-library'
    and exists (
      select 1
      from public.brand_assets asset
      where asset.file_path = storage.objects.name
        and (
          private.is_org_admin(asset.organization_id)
          or (asset.approved and private.is_org_member(asset.organization_id))
          or private.has_delegated_org_capability(asset.organization_id, 'brand')
        )
    )
  );

-- The same name shadowing affected the protection against deleting a template
-- master that is still referenced by a template record.
alter policy template_masters_admin_delete on storage.objects
  using (
    bucket_id = 'template-masters'
    and case
      when (storage.foldername(storage.objects.name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (
        private.is_org_admin(((storage.foldername(storage.objects.name))[1])::uuid)
        or private.has_delegated_org_capability(((storage.foldername(storage.objects.name))[1])::uuid, 'templates')
      )
      else false
    end
    and not exists (
      select 1
      from public.templates template
      where template.master_file_path = storage.objects.name
    )
  );

commit;
