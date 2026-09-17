alter policy templates_admin_insert on public.templates
with check (
  private.is_org_admin(organization_id)
  and created_by = (select auth.uid())
  and status = 'draft'
  and revision = 1
  and master_file_path = organization_id::text || '/' || id::text || '/master.pdf'
);
