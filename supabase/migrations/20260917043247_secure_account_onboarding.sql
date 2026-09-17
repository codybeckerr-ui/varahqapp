begin;

alter table public.organizations
  add column if not exists website text,
  add column if not exists industry text,
  add column if not exists team_size text;

alter table public.organizations
  drop constraint if exists organizations_team_size_check,
  add constraint organizations_team_size_check
    check (
      team_size is null
      or team_size in ('1', '2-10', '11-50', '51-200', '201-1000', '1000+')
    );

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as membership
    where membership.organization_id = org_id
      and membership.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as membership
    where membership.organization_id = org_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('owner', 'admin')
  );
$$;

revoke all on function private.is_org_member(uuid) from public;
revoke all on function private.is_org_admin(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.is_org_admin(uuid) to authenticated;

alter policy org_select_members on public.organizations
  to authenticated
  using ((select private.is_org_member(id)));

alter policy members_select_same_org on public.organization_members
  to authenticated
  using ((select private.is_org_member(organization_id)));

alter policy profiles_select_self on public.profiles
  to authenticated
  using (id = (select auth.uid()));

alter policy profiles_update_self on public.profiles
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy templates_select_members on public.templates
  to authenticated
  using ((select private.is_org_member(organization_id)));

alter policy templates_admin_insert on public.templates
  to authenticated
  with check ((select private.is_org_admin(organization_id)));

alter policy templates_admin_update on public.templates
  to authenticated
  using ((select private.is_org_admin(organization_id)))
  with check ((select private.is_org_admin(organization_id)));

alter policy templates_admin_delete on public.templates
  to authenticated
  using ((select private.is_org_admin(organization_id)));

alter policy fields_select_members on public.template_fields
  to authenticated
  using (
    exists (
      select 1
      from public.templates as template
      where template.id = template_fields.template_id
        and (select private.is_org_member(template.organization_id))
    )
  );

drop policy if exists fields_admin_all on public.template_fields;
drop policy if exists fields_admin_insert on public.template_fields;
drop policy if exists fields_admin_update on public.template_fields;
drop policy if exists fields_admin_delete on public.template_fields;

create policy fields_admin_insert on public.template_fields
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.templates as template
      where template.id = template_fields.template_id
        and (select private.is_org_admin(template.organization_id))
    )
  );

create policy fields_admin_update on public.template_fields
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.templates as template
      where template.id = template_fields.template_id
        and (select private.is_org_admin(template.organization_id))
    )
  )
  with check (
    exists (
      select 1
      from public.templates as template
      where template.id = template_fields.template_id
        and (select private.is_org_admin(template.organization_id))
    )
  );

create policy fields_admin_delete on public.template_fields
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.templates as template
      where template.id = template_fields.template_id
        and (select private.is_org_admin(template.organization_id))
    )
  );

alter policy assets_select_owner_or_admin on public.generated_assets
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_org_admin(organization_id))
  );

alter policy assets_insert_members on public.generated_assets
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_org_member(organization_id))
  );

revoke all on table public.organizations from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.organization_members from anon, authenticated;
revoke all on table public.templates from anon, authenticated;
revoke all on table public.template_fields from anon, authenticated;
revoke all on table public.generated_assets from anon, authenticated;

grant select on table public.organizations to authenticated;
grant select, update on table public.profiles to authenticated;
grant select on table public.organization_members to authenticated;
grant select, insert, update, delete on table public.templates to authenticated;
grant select, insert, update, delete on table public.template_fields to authenticated;
grant select, insert on table public.generated_assets to authenticated;

create index if not exists idx_generated_assets_template
  on public.generated_assets (template_id);
create index if not exists idx_generated_assets_user
  on public.generated_assets (user_id);
create index if not exists idx_templates_created_by
  on public.templates (created_by);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_name text := nullif(trim(new.raw_user_meta_data ->> 'organization_name'), '');
  organization_website text := nullif(trim(new.raw_user_meta_data ->> 'website'), '');
  organization_industry text := nullif(trim(new.raw_user_meta_data ->> 'industry'), '');
  organization_team_size text := nullif(trim(new.raw_user_meta_data ->> 'team_size'), '');
  organization_id uuid;
  slug_base text;
  organization_slug text;
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name);

  if organization_name is null then
    return new;
  end if;

  if char_length(organization_name) > 120 then
    raise exception 'Organization name must be 120 characters or fewer';
  end if;

  if organization_website is not null and char_length(organization_website) > 255 then
    raise exception 'Website must be 255 characters or fewer';
  end if;

  if organization_industry is not null and char_length(organization_industry) > 80 then
    raise exception 'Industry must be 80 characters or fewer';
  end if;

  if organization_team_size is not null
    and organization_team_size not in ('1', '2-10', '11-50', '51-200', '201-1000', '1000+') then
    raise exception 'Invalid team size';
  end if;

  if lower(new.email) = 'codybeckerr@gmail.com'
    and lower(organization_name) = 'test company' then
    select organization.id
      into organization_id
      from public.organizations as organization
      where lower(organization.name) = 'test company'
      order by organization.created_at
      limit 1;

    if organization_id is null then
      raise exception 'The existing Test Company organization could not be found';
    end if;

    update public.organizations
      set website = coalesce(organization_website, website),
          industry = coalesce(organization_industry, industry),
          team_size = coalesce(organization_team_size, team_size)
      where id = organization_id;
  else
    if lower(organization_name) = 'test company' then
      raise exception 'This organization name is reserved';
    end if;

    slug_base := trim(both '-' from regexp_replace(lower(organization_name), '[^a-z0-9]+', '-', 'g'));
    if slug_base = '' then
      slug_base := 'organization';
    end if;
    organization_slug := left(slug_base, 70) || '-' || substr(new.id::text, 1, 8);

    insert into public.organizations (name, slug, website, industry, team_size)
    values (
      organization_name,
      organization_slug,
      organization_website,
      organization_industry,
      organization_team_size
    )
    returning id into organization_id;
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (organization_id, new.id, 'owner')
  on conflict (organization_id, user_id) do update set role = 'owner';

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

drop function if exists public.handle_new_user();
drop function if exists public.is_org_member(uuid);
drop function if exists public.is_org_admin(uuid);

commit;
