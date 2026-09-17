-- Private, tenant-scoped storage for immutable source PDFs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('template-masters', 'template-masters', false, 26214400, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "template_masters_admin_select" on storage.objects;
create policy "template_masters_admin_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'template-masters'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then private.is_org_admin(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists "template_masters_admin_insert" on storage.objects;
create policy "template_masters_admin_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'template-masters'
  and lower(storage.extension(name)) = 'pdf'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then private.is_org_admin(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists "template_masters_admin_update" on storage.objects;
create policy "template_masters_admin_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'template-masters'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then private.is_org_admin(((storage.foldername(name))[1])::uuid)
    else false
  end
)
with check (
  bucket_id = 'template-masters'
  and lower(storage.extension(name)) = 'pdf'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then private.is_org_admin(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists "template_masters_admin_delete" on storage.objects;
create policy "template_masters_admin_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'template-masters'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then private.is_org_admin(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists "templates_admin_insert" on public.templates;
create policy "templates_admin_insert"
on public.templates for insert
to authenticated
with check (
  (select private.is_org_admin(templates.organization_id))
  and templates.created_by = (select auth.uid())
);
