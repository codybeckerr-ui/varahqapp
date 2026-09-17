begin;

alter policy brand_assets_admin_insert on public.brand_assets
with check (
  private.is_org_admin(organization_id)
  and uploaded_by = (select auth.uid())
  and file_path like organization_id::text || '/%'
);

alter policy personal_library_own_read on public.personal_library_items
using (
  user_id = (select auth.uid())
  and private.is_org_member(organization_id)
);

alter policy personal_library_own_insert on public.personal_library_items
with check (
  user_id = (select auth.uid())
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
        and generated.user_id = (select auth.uid())
    ))
  )
);

alter policy personal_library_own_delete on public.personal_library_items
using (user_id = (select auth.uid()));

create index brand_assets_uploaded_by_idx on public.brand_assets (uploaded_by);
create index personal_library_organization_idx on public.personal_library_items (organization_id);
create index personal_library_brand_asset_fk_idx on public.personal_library_items (brand_asset_id);
create index personal_library_template_fk_idx on public.personal_library_items (template_id);
create index personal_library_generated_asset_fk_idx on public.personal_library_items (generated_asset_id);

commit;
