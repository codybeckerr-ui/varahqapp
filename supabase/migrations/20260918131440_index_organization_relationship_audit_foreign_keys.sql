create index organization_relationships_created_by_idx
  on public.organization_relationships (created_by);

create index organization_access_grants_granted_by_idx
  on public.organization_access_grants (granted_by);
