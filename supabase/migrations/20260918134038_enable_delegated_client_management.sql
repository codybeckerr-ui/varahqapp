begin;

-- A partner grant is intentionally capability-specific. Each policy keeps the
-- existing organization-member path and adds only the delegated capability
-- needed for that resource.

alter policy members_select_same_org on public.organization_members
  using (
    (select private.is_org_member(organization_id))
    or (select private.has_delegated_org_capability(organization_id, 'members'))
  );

drop policy if exists profiles_select_same_org on public.profiles;
create policy profiles_select_same_org on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.organization_members membership
      where membership.user_id = profiles.id
        and (
          (select private.is_org_member(membership.organization_id))
          or (select private.has_delegated_org_capability(membership.organization_id, 'members'))
        )
    )
  );

alter policy templates_select_members on public.templates
  using (
    (select private.is_org_admin(organization_id))
    or (status = 'published' and (select private.is_org_member(organization_id)))
    or (select private.has_delegated_org_capability(organization_id, 'templates'))
  );

alter policy templates_admin_insert on public.templates
  with check (
    (
      (select private.is_org_admin(organization_id))
      or (select private.has_delegated_org_capability(organization_id, 'templates'))
    )
    and created_by = (select auth.uid())
    and status = 'draft'
    and revision = 1
    and master_file_path = organization_id::text || '/' || id::text || '/master.pdf'
  );

alter policy templates_admin_update on public.templates
  using (
    (select private.is_org_admin(organization_id))
    or (select private.has_delegated_org_capability(organization_id, 'templates'))
  )
  with check (
    (select private.is_org_admin(organization_id))
    or (select private.has_delegated_org_capability(organization_id, 'templates'))
  );

alter policy templates_admin_delete on public.templates
  using (
    (select private.is_org_admin(organization_id))
    or (select private.has_delegated_org_capability(organization_id, 'templates'))
  );

alter policy fields_select_members on public.template_fields
  using (
    exists (
      select 1 from public.templates template
      where template.id = template_fields.template_id
        and (
          (select private.is_org_member(template.organization_id))
          or (select private.has_delegated_org_capability(template.organization_id, 'templates'))
        )
    )
  );

alter policy fields_admin_insert on public.template_fields
  with check (
    exists (
      select 1 from public.templates template
      where template.id = template_fields.template_id
        and (
          (select private.is_org_admin(template.organization_id))
          or (select private.has_delegated_org_capability(template.organization_id, 'templates'))
        )
    )
  );

alter policy fields_admin_update on public.template_fields
  using (
    exists (
      select 1 from public.templates template
      where template.id = template_fields.template_id
        and (
          (select private.is_org_admin(template.organization_id))
          or (select private.has_delegated_org_capability(template.organization_id, 'templates'))
        )
    )
  )
  with check (
    exists (
      select 1 from public.templates template
      where template.id = template_fields.template_id
        and (
          (select private.is_org_admin(template.organization_id))
          or (select private.has_delegated_org_capability(template.organization_id, 'templates'))
        )
    )
  );

alter policy fields_admin_delete on public.template_fields
  using (
    exists (
      select 1 from public.templates template
      where template.id = template_fields.template_id
        and (
          (select private.is_org_admin(template.organization_id))
          or (select private.has_delegated_org_capability(template.organization_id, 'templates'))
        )
    )
  );

create or replace function private.touch_template_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare tid uuid; current_status public.template_status;
begin
  tid := case when TG_OP = 'DELETE' then old.template_id else new.template_id end;
  if TG_OP = 'UPDATE' and new.template_id <> old.template_id then
    raise exception 'A field cannot move between templates';
  end if;
  if (select auth.uid()) is null or not exists (
    select 1 from public.templates template
    where template.id = tid
      and (
        private.is_org_admin(template.organization_id)
        or private.has_delegated_org_capability(template.organization_id, 'templates')
      )
  ) then
    raise exception 'Administrator access required';
  end if;
  select status into current_status from public.templates where id = tid for update;
  if current_status in ('published', 'archived') then
    raise exception 'Return the template to draft before changing its fields';
  end if;
  update public.templates set revision = revision + 1, status = 'draft' where id = tid;
  return case when TG_OP = 'DELETE' then old else new end;
end;
$$;

create or replace function public.save_template_fields(p_template_id uuid, p_revision integer, p_fields jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare t public.templates; r integer;
begin
  select * into t from public.templates where id = p_template_id for update;
  if t.id is null or not (
    private.is_org_admin(t.organization_id)
    or private.has_delegated_org_capability(t.organization_id, 'templates')
  ) then
    raise exception 'Administrator access required';
  end if;
  if t.revision <> p_revision then raise exception 'This template changed. Reopen it before saving'; end if;
  if jsonb_typeof(p_fields) <> 'array' or jsonb_array_length(p_fields) > 40 or jsonb_array_length(p_fields) = 0 then
    raise exception 'Configure between 1 and 40 fields';
  end if;
  delete from public.template_fields where template_id = p_template_id;
  insert into public.template_fields (template_id,variable_name,label,field_type,data_source,page_number,x,y,width,height,font_family,font_weight,font_size,min_font_size,text_color,alignment,overflow_rule,max_lines,required,user_editable,style_metadata)
  select p_template_id,f.variable_name,f.label,'text',f.data_source,f.page_number,f.x,f.y,f.width,f.height,f.font_family,f.font_weight,f.font_size,f.min_font_size,f.text_color,f.alignment,f.overflow_rule,f.max_lines,f.required,f.user_editable,f.style_metadata
  from jsonb_to_recordset(p_fields) as f(variable_name text,label text,data_source text,page_number integer,x numeric,y numeric,width numeric,height numeric,font_family text,font_weight text,font_size numeric,min_font_size numeric,text_color text,alignment text,overflow_rule text,max_lines integer,required boolean,user_editable boolean,style_metadata jsonb);
  select revision into r from public.templates where id = p_template_id;
  return r;
end;
$$;

alter policy compilations_read on public.template_compilations
  using (
    exists (
      select 1 from public.templates template
      where template.id = template_id
        and (
          (select private.is_org_admin(template.organization_id))
          or (template.status = 'published' and (select private.is_org_member(template.organization_id)))
          or (select private.has_delegated_org_capability(template.organization_id, 'templates'))
        )
    )
  );

alter policy assets_select_owner_or_admin on public.generated_assets
  using (
    user_id = (select auth.uid())
    or (select private.is_org_admin(organization_id))
    or (select private.has_delegated_org_access(organization_id))
  );

alter policy org_update_admins on public.organizations
  using (
    (select private.is_org_admin(id))
    or (select private.has_delegated_org_capability(id, 'settings'))
  )
  with check (
    (select private.is_org_admin(id))
    or (select private.has_delegated_org_capability(id, 'settings'))
  );

alter policy brand_assets_read on public.brand_assets
  using (
    (select private.is_org_admin(organization_id))
    or (approved and (select private.is_org_member(organization_id)))
    or (select private.has_delegated_org_capability(organization_id, 'brand'))
  );

alter policy brand_assets_admin_insert on public.brand_assets
  with check (
    (
      (select private.is_org_admin(organization_id))
      or (select private.has_delegated_org_capability(organization_id, 'brand'))
    )
    and uploaded_by = (select auth.uid())
    and file_path like organization_id::text || '/%'
  );

alter policy brand_assets_admin_update on public.brand_assets
  using (
    (select private.is_org_admin(organization_id))
    or (select private.has_delegated_org_capability(organization_id, 'brand'))
  )
  with check (
    (
      (select private.is_org_admin(organization_id))
      or (select private.has_delegated_org_capability(organization_id, 'brand'))
    )
    and file_path like organization_id::text || '/%'
  );

alter policy brand_assets_admin_delete on public.brand_assets
  using (
    (select private.is_org_admin(organization_id))
    or (select private.has_delegated_org_capability(organization_id, 'brand'))
  );

create or replace function public.set_primary_brand_logo(p_asset_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare target public.brand_assets;
begin
  select * into target from public.brand_assets where id = p_asset_id for update;
  if target.id is null or target.category <> 'logo' or not target.approved or not (
    private.is_org_admin(target.organization_id)
    or private.has_delegated_org_capability(target.organization_id, 'brand')
  ) then
    raise exception 'An approved organization logo is required';
  end if;
  update public.brand_assets set is_primary_logo = false, updated_at = now()
    where organization_id = target.organization_id and is_primary_logo;
  update public.brand_assets set is_primary_logo = true, updated_at = now() where id = target.id;
end;
$$;

alter policy template_masters_admin_select on storage.objects
  using (
    bucket_id = 'template-masters'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then private.is_org_admin(((storage.foldername(name))[1])::uuid)
        or private.has_delegated_org_capability(((storage.foldername(name))[1])::uuid, 'templates')
      else false
    end
  );

alter policy template_masters_admin_insert on storage.objects
  with check (
    bucket_id = 'template-masters'
    and lower(storage.extension(name)) = 'pdf'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then private.is_org_admin(((storage.foldername(name))[1])::uuid)
        or private.has_delegated_org_capability(((storage.foldername(name))[1])::uuid, 'templates')
      else false
    end
  );

alter policy template_masters_admin_delete on storage.objects
  using (
    bucket_id = 'template-masters'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (
        private.is_org_admin(((storage.foldername(name))[1])::uuid)
        or private.has_delegated_org_capability(((storage.foldername(name))[1])::uuid, 'templates')
      )
      else false
    end
    and not exists (select 1 from public.templates template where template.master_file_path = name)
  );

alter policy brand_library_files_read on storage.objects
  using (
    bucket_id = 'brand-library'
    and exists (
      select 1 from public.brand_assets asset
      where asset.file_path = name
        and (
          private.is_org_admin(asset.organization_id)
          or (asset.approved and private.is_org_member(asset.organization_id))
          or private.has_delegated_org_capability(asset.organization_id, 'brand')
        )
    )
  );

alter policy brand_library_files_insert on storage.objects
  with check (
    bucket_id = 'brand-library'
    and lower(storage.extension(name)) in ('png','jpg','jpeg','svg','pdf','eps','ai','dst','pes','exp','jef','ttf','otf')
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then private.is_org_admin(((storage.foldername(name))[1])::uuid)
        or private.has_delegated_org_capability(((storage.foldername(name))[1])::uuid, 'brand')
      else false
    end
  );

alter policy brand_library_files_delete on storage.objects
  using (
    bucket_id = 'brand-library'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then private.is_org_admin(((storage.foldername(name))[1])::uuid)
        or private.has_delegated_org_capability(((storage.foldername(name))[1])::uuid, 'brand')
      else false
    end
  );

alter policy fonts_read on public.organization_fonts
  using (
    (select private.is_org_member(organization_id))
    or (select private.has_delegated_org_capability(organization_id, 'templates'))
  );

commit;
