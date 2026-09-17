begin;
alter table public.templates add column revision integer not null default 1;
create table public.template_compilations (
 template_id uuid primary key references public.templates(id) on delete cascade,
 revision integer not null, bundle_path text not null, report jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.template_compilations enable row level security;
revoke all on public.template_compilations from anon,authenticated;
grant select on public.template_compilations to authenticated;
grant all on public.template_compilations to service_role;
create policy compilations_read on public.template_compilations for select to authenticated using (
 exists(select 1 from public.templates t where t.id=template_id and (private.is_org_admin(t.organization_id) or (t.status='published' and private.is_org_member(t.organization_id))))
);
-- Only the publishing service may change lifecycle state or source identity.
revoke update on public.templates from authenticated;
grant update(name,description) on public.templates to authenticated;
drop policy templates_admin_insert on public.templates;
create policy templates_admin_insert on public.templates for insert to authenticated with check (
 private.is_org_admin(organization_id) and created_by=auth.uid() and status='draft' and revision=1
 and master_file_path=organization_id::text||'/'||id::text||'/master.pdf'
);
alter policy templates_select_members on public.templates using (
 private.is_org_admin(organization_id) or (status='published' and private.is_org_member(organization_id))
);
create or replace function private.touch_template_fields() returns trigger language plpgsql security definer set search_path='' as $$
declare tid uuid; current_status public.template_status;
begin
 tid := case when TG_OP='DELETE' then old.template_id else new.template_id end;
 if TG_OP='UPDATE' and new.template_id<>old.template_id then raise exception 'A field cannot move between templates'; end if;
 if auth.uid() is null or not exists(select 1 from public.templates t where t.id=tid and private.is_org_admin(t.organization_id)) then raise exception 'Administrator access required'; end if;
 select status into current_status from public.templates where id=tid for update;
 if current_status in ('published','archived') then raise exception 'Return the template to draft before changing its fields'; end if;
 update public.templates set revision=revision+1,status='draft' where id=tid;
 return case when TG_OP='DELETE' then old else new end;
end $$;
revoke all on function private.touch_template_fields() from public,anon,authenticated;
create trigger template_fields_revision before insert or update or delete on public.template_fields for each row execute function private.touch_template_fields();
-- Transactional save, using the caller's RLS and an optimistic revision check.
create function public.save_template_fields(p_template_id uuid,p_revision integer,p_fields jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare t public.templates; r integer;
begin
 select * into t from public.templates where id=p_template_id for update;
 if t.id is null or not private.is_org_admin(t.organization_id) then raise exception 'Administrator access required'; end if;
 if t.revision<>p_revision then raise exception 'This template changed. Reopen it before saving'; end if;
 if jsonb_typeof(p_fields)<>'array' or jsonb_array_length(p_fields)>40 or jsonb_array_length(p_fields)=0 then raise exception 'Configure between 1 and 40 fields'; end if;
 delete from public.template_fields where template_id=p_template_id;
 insert into public.template_fields (template_id,variable_name,label,field_type,data_source,page_number,x,y,width,height,font_family,font_weight,font_size,min_font_size,text_color,alignment,overflow_rule,max_lines,required,user_editable,style_metadata)
 select p_template_id,f.variable_name,f.label,'text',f.data_source,f.page_number,f.x,f.y,f.width,f.height,f.font_family,f.font_weight,f.font_size,f.min_font_size,f.text_color,f.alignment,f.overflow_rule,f.max_lines,f.required,f.user_editable,f.style_metadata
 from jsonb_to_recordset(p_fields) as f(variable_name text,label text,data_source text,page_number integer,x numeric,y numeric,width numeric,height numeric,font_family text,font_weight text,font_size numeric,min_font_size numeric,text_color text,alignment text,overflow_rule text,max_lines integer,required boolean,user_editable boolean,style_metadata jsonb);
 select revision into r from public.templates where id=p_template_id;
 return r;
end $$;
revoke all on function public.save_template_fields(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_template_fields(uuid,integer,jsonb) to authenticated;
-- Called only by the authenticated server gateway, never directly by a browser.
create function public.record_template_test(p_template_id uuid,p_revision integer,p_bundle_path text,p_report jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.templates where id=p_template_id and revision=p_revision and status in ('draft','testing') for update;
 if not found then raise exception 'Template changed while testing. Test the latest saved version'; end if;
 insert into public.template_compilations(template_id,revision,bundle_path,report) values(p_template_id,p_revision,p_bundle_path,p_report)
 on conflict(template_id) do update set revision=excluded.revision,bundle_path=excluded.bundle_path,report=excluded.report,created_at=now();
 update public.templates set status='testing' where id=p_template_id;
end $$;
create function public.set_template_publication(p_template_id uuid,p_revision integer,p_publish boolean) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.templates where id=p_template_id and revision=p_revision for update;
 if not found then raise exception 'Template changed. Reopen it and try again'; end if;
 if p_publish then
  if not exists(select 1 from public.template_compilations where template_id=p_template_id and revision=p_revision) then raise exception 'Run a successful test before publishing'; end if;
  update public.templates set status='published' where id=p_template_id and status='testing';
  if not found then raise exception 'Only a tested template can be published'; end if;
 else
  update public.templates set status='draft',revision=revision+1 where id=p_template_id;
 end if;
end $$;
revoke all on function public.record_template_test(uuid,integer,text,jsonb) from public,anon,authenticated;
revoke all on function public.set_template_publication(uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.record_template_test(uuid,integer,text,jsonb) to service_role;
grant execute on function public.set_template_publication(uuid,integer,boolean) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('template-compiled','template-compiled',false,26214400,array['application/json']),
 ('generated-assets','generated-assets',false,26214400,array['application/pdf','image/png','image/jpeg']),
 ('brand-fonts','brand-fonts',false,5242880,array['font/ttf','font/otf','application/octet-stream'])
 on conflict(id) do nothing;
create policy compiled_read on storage.objects for select to authenticated using (
 bucket_id='template-compiled' and exists(select 1 from public.template_compilations c where c.bundle_path=name)
);
create policy generated_read on storage.objects for select to authenticated using (
 bucket_id='generated-assets' and exists(select 1 from public.generated_assets a where a.file_path=name)
);
-- Master objects cannot be replaced or removed once referenced by a template.
drop policy template_masters_admin_update on storage.objects;
alter policy template_masters_admin_delete on storage.objects using (
 bucket_id='template-masters' and exists(select 1 from public.organization_members m where m.organization_id::text=(storage.foldername(name))[1] and m.user_id=auth.uid() and m.role in ('owner','admin'))
 and not exists(select 1 from public.templates t where t.master_file_path=name)
);
revoke insert on public.generated_assets from authenticated;
create table public.organization_fonts (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 name text not null, file_path text not null unique, created_at timestamptz not null default now()
);
alter table public.organization_fonts enable row level security;
revoke all on public.organization_fonts from anon,authenticated;
create index organization_fonts_org_idx on public.organization_fonts(organization_id);
grant select on public.organization_fonts to authenticated;
grant all on public.organization_fonts to service_role;
create policy fonts_read on public.organization_fonts for select to authenticated using(private.is_org_member(organization_id));
create policy font_files_read on storage.objects for select to authenticated using(bucket_id='brand-fonts' and exists(select 1 from public.organization_fonts f where f.file_path=name));
commit;
