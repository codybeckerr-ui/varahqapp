import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });
}

function slugify(name: string, id: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'organization';
  return `${base}-${id.slice(0, 8)}`;
}

function validWebsite(value: string | null) {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch { return false; }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return fail('Method not allowed.', 405);
  let createdOrganizationId = '';
  try {
    const authorization = request.headers.get('Authorization') || '';
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: userError } = await db.auth.getUser(authorization.replace(/^Bearer /, ''));
    if (userError || !user) return fail('Please sign in again.', 401);
    const raw = await request.text();
    if (raw.length > 20_000) return fail('The request is too large.');
    const body = JSON.parse(raw);
    if (body.action !== 'create_client') return fail('Unknown partner action.');
    if (!uuidPattern.test(body.partner_organization_id || '')) return fail('Choose a partner organization.');

    const { data: membership, error: membershipError } = await db.from('organization_members').select('role,organizations!inner(organization_type)').eq('organization_id', body.partner_organization_id).eq('user_id', user.id).maybeSingle();
    if (membershipError) throw membershipError;
    const organization = Array.isArray(membership?.organizations) ? membership.organizations[0] : membership?.organizations;
    if (!membership || !['owner', 'admin'].includes(membership.role) || organization?.organization_type !== 'partner') return fail('Agency administrator access required.', 403);

    const name = String(body.name || '').trim();
    const website = body.website ? String(body.website).trim() : null;
    const industry = body.industry ? String(body.industry).trim() : null;
    if (!name || name.length > 120) return fail('Enter an organization name of 120 characters or fewer.');
    if (website && website.length > 255) return fail('Website must be 255 characters or fewer.');
    if (!validWebsite(website)) return fail('Enter a complete website address beginning with http:// or https://.');
    if (industry && industry.length > 80) return fail('Industry must be 80 characters or fewer.');

    createdOrganizationId = crypto.randomUUID();
    const { data: client, error: clientError } = await db.from('organizations').insert({ id: createdOrganizationId, name, slug: slugify(name, createdOrganizationId), website, industry, organization_type:'company' }).select('id,name,slug,website,industry,organization_type').single();
    if (clientError) throw clientError;

    const { data: relationship, error: relationshipError } = await db.from('organization_relationships').insert({ managing_organization_id:body.partner_organization_id, client_organization_id:createdOrganizationId, created_by:user.id }).select('id,status,created_at').single();
    if (relationshipError) throw relationshipError;

    const { error: grantError } = await db.from('organization_access_grants').insert({ relationship_id:relationship.id, user_id:user.id, can_view:true, can_manage_templates:true, can_manage_brand:true, can_manage_members:true, can_manage_settings:true, can_review_approvals:true, granted_by:user.id });
    if (grantError) throw grantError;

    return Response.json({ ok:true, client, relationship }, { headers: { ...cors, 'Cache-Control':'no-store' } });
  } catch (error) {
    console.error('partner-management failed', error instanceof Error ? error.message : 'Unknown error');
    if (createdOrganizationId) {
      const cleanup = createClient(url, serviceKey, { auth: { persistSession:false, autoRefreshToken:false } });
      await cleanup.from('organizations').delete().eq('id', createdOrganizationId);
    }
    return fail(error instanceof Error ? error.message : 'The partner action failed.');
  }
});
