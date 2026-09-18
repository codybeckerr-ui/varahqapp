# VaraHQ organization and partner access model

## Product rule

Every customer organization is independent by default. A company can create and use a VaraHQ account without an agency or other parent organization.

A partner relationship is optional. It gives selected users from a partner organization specific management capabilities inside a client organization. It does not transfer ownership of the client organization or its data.

## Identity and access layers

VaraHQ keeps these concepts separate:

1. A Supabase Auth user is the person's login identity.
2. A profile stores that person's contact and personalization data.
3. An organization is either a normal company or a partner account.
4. `organization_members` assigns a person's direct role inside an organization. A person may be a direct member of more than one organization.
5. `organization_relationships` connects a managing partner organization to an independent client organization.
6. `organization_access_grants` gives one partner user explicit capabilities for one client relationship.

Platform-wide VaraHQ staff permissions must remain separate from customer organization roles and partner grants.

## Ownership and boundaries

- Templates, brand files, generated assets, members, settings, and billing belong to the client organization identified by their `organization_id`.
- A partner user does not become a client member merely because a relationship exists.
- Delegated access requires an active relationship, a grant for the signed-in user, and current membership in the managing partner organization.
- Removing a grant or ending a relationship removes delegated access without moving or deleting client data.
- Client management surfaces authorize the exact named delegated capability for templates, brand files, members, and organization settings. Personal libraries remain tied to direct organization membership.

## Delegated capabilities

The initial capability set is:

- view the client workspace
- manage templates
- manage brand assets
- manage members
- manage organization settings
- review approvals

Each client-facing policy or server operation must check the exact capability it needs. Do not replace the direct-membership helper with a broad partner-access helper because that would silently grant every client permission at once.

## Workspace behavior

The application loads every direct organization membership and lets multi-organization users choose an active workspace. The selection is stored per user in the browser and is always checked against the memberships returned under RLS.

The partner dashboard is an additional management layer:

1. A partner user opens the partner workspace.
2. The dashboard lists the partner's client relationships and only enables **Manage client** when the signed-in agency user has an active view grant.
3. Opening a client establishes an explicit client context.
4. Each action is authorized again through RLS and server functions using the relevant delegated capability.
5. The UI clearly identifies both the client being managed and the partner organization providing access.

## Implementation sequence

1. Keep independent company signup as the default (`organization_type = 'company'`).
2. Provision partner organizations only through trusted server-side administration.
3. Build server-side partner onboarding that creates relationships and grants transactionally.
4. Continue refining the partner dashboard and client workspace backed by scoped queries.
5. Maintain tenant-isolation tests for direct members, granted partner users, ungranted partner users, paused relationships, and unrelated users as each client workflow expands.
6. Add billing, reporting, white-label settings, and storage aggregation after the access model is proven.
