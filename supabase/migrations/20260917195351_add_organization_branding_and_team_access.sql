alter table public.organizations
  add column if not exists primary_color text not null default '#0F2D24',
  add column if not exists secondary_color text not null default '#7A9B87',
  add column if not exists background_color text not null default '#E8E7E1';

alter table public.organizations
  drop constraint if exists organizations_name_length_check,
  add constraint organizations_name_length_check check (char_length(trim(name)) between 1 and 120),
  drop constraint if exists organizations_website_length_check,
  add constraint organizations_website_length_check check (website is null or char_length(website) <= 255),
  drop constraint if exists organizations_primary_color_check,
  add constraint organizations_primary_color_check check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  drop constraint if exists organizations_secondary_color_check,
  add constraint organizations_secondary_color_check check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  drop constraint if exists organizations_background_color_check,
  add constraint organizations_background_color_check check (background_color ~ '^#[0-9A-Fa-f]{6}$');

grant update (name, website, primary_color, secondary_color, background_color)
  on table public.organizations to authenticated;

drop policy if exists org_update_admins on public.organizations;
create policy org_update_admins on public.organizations for update to authenticated
  using ((select private.is_org_admin(id)))
  with check ((select private.is_org_admin(id)));

drop policy if exists profiles_select_same_org on public.profiles;
create policy profiles_select_same_org on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.organization_members as membership
      where membership.user_id = profiles.id
        and (select private.is_org_member(membership.organization_id))
    )
  );
