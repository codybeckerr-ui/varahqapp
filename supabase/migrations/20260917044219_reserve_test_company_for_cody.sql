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

  if lower(new.email) = 'codybeckerr@gmail.com' then
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
