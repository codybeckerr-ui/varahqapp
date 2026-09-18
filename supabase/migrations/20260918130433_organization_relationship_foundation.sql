begin;

alter table public.organizations
  add column if not exists organization_type text not null default 'company';

alter table public.organizations
  drop constraint if exists organizations_organization_type_check,
  add constraint organizations_organization_type_check
    check (organization_type in ('company', 'partner'));

create table public.organization_relationships (
  id uuid primary key default gen_random_uuid(),
  managing_organization_id uuid not null references public.organizations(id) on delete cascade,
  client_organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'paused', 'ended')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_relationships_distinct_organizations
    check (managing_organization_id <> client_organization_id),
  constraint organization_relationships_unique_pair
    unique (managing_organization_id, client_organization_id)
);

create index organization_relationships_client_idx
  on public.organization_relationships (client_organization_id, status);
create index organization_relationships_manager_idx
  on public.organization_relationships (managing_organization_id, status);

create table public.organization_access_grants (
  relationship_id uuid not null references public.organization_relationships(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  can_view boolean not null default true,
  can_manage_templates boolean not null default false,
  can_manage_brand boolean not null default false,
  can_manage_members boolean not null default false,
  can_manage_settings boolean not null default false,
  can_review_approvals boolean not null default false,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (relationship_id, user_id)
);

create index organization_access_grants_user_idx
  on public.organization_access_grants (user_id);

create or replace function private.validate_organization_relationship()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.organizations organization
    where organization.id = new.managing_organization_id
      and organization.organization_type = 'partner'
  ) then
    raise exception 'The managing organization must be a partner organization';
  end if;
  return new;
end;
$$;

create or replace function private.validate_organization_access_grant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.organization_relationships relationship
    join public.organization_members membership
      on membership.organization_id = relationship.managing_organization_id
    where relationship.id = new.relationship_id
      and membership.user_id = new.user_id
  ) then
    raise exception 'Delegated users must belong to the managing partner organization';
  end if;
  return new;
end;
$$;

create trigger organization_relationships_validate
  before insert or update of managing_organization_id, client_organization_id
  on public.organization_relationships
  for each row execute function private.validate_organization_relationship();

create trigger organization_access_grants_validate
  before insert or update of relationship_id, user_id
  on public.organization_access_grants
  for each row execute function private.validate_organization_access_grant();

revoke all on function private.validate_organization_relationship() from public;
revoke all on function private.validate_organization_access_grant() from public;

create trigger organization_relationships_set_updated_at
  before update on public.organization_relationships
  for each row execute function public.set_updated_at();

create trigger organization_access_grants_set_updated_at
  before update on public.organization_access_grants
  for each row execute function public.set_updated_at();

alter table public.organization_relationships enable row level security;
alter table public.organization_access_grants enable row level security;

create or replace function private.has_delegated_org_access(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_relationships relationship
    join public.organization_access_grants access
      on access.relationship_id = relationship.id
    join public.organization_members partner_membership
      on partner_membership.organization_id = relationship.managing_organization_id
     and partner_membership.user_id = access.user_id
    where relationship.client_organization_id = org_id
      and relationship.status = 'active'
      and access.user_id = (select auth.uid())
      and access.can_view
  );
$$;

create or replace function private.has_delegated_org_capability(
  org_id uuid,
  capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_relationships relationship
    join public.organization_access_grants access
      on access.relationship_id = relationship.id
    join public.organization_members partner_membership
      on partner_membership.organization_id = relationship.managing_organization_id
     and partner_membership.user_id = access.user_id
    where relationship.client_organization_id = org_id
      and relationship.status = 'active'
      and access.user_id = (select auth.uid())
      and access.can_view
      and case capability
        when 'templates' then access.can_manage_templates
        when 'brand' then access.can_manage_brand
        when 'members' then access.can_manage_members
        when 'settings' then access.can_manage_settings
        when 'approvals' then access.can_review_approvals
        else false
      end
  );
$$;

revoke all on function private.has_delegated_org_access(uuid) from public;
revoke all on function private.has_delegated_org_capability(uuid, text) from public;
grant execute on function private.has_delegated_org_access(uuid) to authenticated;
grant execute on function private.has_delegated_org_capability(uuid, text) to authenticated;

create or replace function private.can_read_org_relationship(p_relationship_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_relationships relationship
    where relationship.id = p_relationship_id
      and (
        exists (
          select 1
          from public.organization_members membership
          where membership.user_id = (select auth.uid())
            and membership.organization_id in (
              relationship.managing_organization_id,
              relationship.client_organization_id
            )
            and membership.role in ('owner', 'admin')
        )
        or exists (
          select 1
          from public.organization_access_grants access
          join public.organization_members partner_membership
            on partner_membership.organization_id = relationship.managing_organization_id
           and partner_membership.user_id = access.user_id
          where access.relationship_id = relationship.id
            and access.user_id = (select auth.uid())
            and access.can_view
        )
      )
  );
$$;

revoke all on function private.can_read_org_relationship(uuid) from public;
grant execute on function private.can_read_org_relationship(uuid) to authenticated;

create policy organization_relationships_read_participants
  on public.organization_relationships for select to authenticated
  using ((select private.can_read_org_relationship(id)));

create policy organization_access_grants_read_participants
  on public.organization_access_grants for select to authenticated
  using ((select private.can_read_org_relationship(relationship_id)));

drop policy if exists org_select_members on public.organizations;
create policy org_select_authorized
  on public.organizations for select to authenticated
  using (
    (select private.is_org_member(id))
    or (select private.has_delegated_org_access(id))
  );

revoke all on table public.organization_relationships from anon, authenticated;
revoke all on table public.organization_access_grants from anon, authenticated;
grant select on table public.organization_relationships to authenticated;
grant select on table public.organization_access_grants to authenticated;
grant all on table public.organization_relationships to service_role;
grant all on table public.organization_access_grants to service_role;

comment on column public.organizations.organization_type is
  'company organizations operate independently; partner organizations may receive explicit delegated access to clients.';
comment on table public.organization_relationships is
  'Optional management relationships. Client organizations remain independent and own their data.';
comment on table public.organization_access_grants is
  'Per-user, per-client delegated capabilities for members of a managing partner organization.';

commit;
