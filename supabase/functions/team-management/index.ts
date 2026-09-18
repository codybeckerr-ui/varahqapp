import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return fail('Method not allowed.', 405);
  try {
    const authorization = request.headers.get('Authorization') || '';
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: userError } = await db.auth.getUser(authorization.replace(/^Bearer /, ''));
    if (userError || !user) return fail('Please sign in again.', 401);
    const raw = await request.text();
    if (raw.length > 20_000) return fail('The request is too large.');
    const body = JSON.parse(raw);
    if (!uuid.test(body.organization_id || '')) return fail('Choose an organization.');
    const { data: caller, error: callerError } = await db.from('organization_members').select('role').eq('organization_id', body.organization_id).eq('user_id', user.id).maybeSingle();
    if (callerError) throw callerError;
    if (!caller || !['owner', 'admin'].includes(caller.role)) return fail('Administrator access required.', 403);

    if (body.action === 'invite') {
      const email = String(body.email || '').trim().toLowerCase();
      const fullName = String(body.full_name || '').trim();
      const role = body.role === 'admin' ? 'admin' : 'member';
      if (!emailPattern.test(email) || email.length > 255) return fail('Enter a valid email address.');
      if (!fullName || fullName.length > 120) return fail('Enter the team member’s name.');
      if (email === String(user.email || '').toLowerCase()) return fail('You are already on this team.');
      const { data: existingProfile, error: profileError } = await db.from('profiles').select('id,email').ilike('email', email).maybeSingle();
      if (profileError) throw profileError;
      let invitedUserId = existingProfile?.id;
      let createdInvitation = false;
      if (invitedUserId) {
        const { data: memberships, error: membershipError } = await db.from('organization_members').select('organization_id').eq('user_id', invitedUserId);
        if (membershipError) throw membershipError;
        if (memberships?.some((membership) => membership.organization_id === body.organization_id)) return fail('That person is already on this team.');
      } else {
        const { data: invitation, error: invitationError } = await db.auth.admin.inviteUserByEmail(email, {
          data: { full_name: fullName },
          redirectTo: 'https://varahqapp.vercel.app/index.html#signin',
        });
        if (invitationError) throw invitationError;
        invitedUserId = invitation.user?.id;
        createdInvitation = true;
      }
      if (!invitedUserId) return fail('The invitation could not be created.');
      const { error: profileUpsertError } = await db.from('profiles').upsert({ id: invitedUserId, email, full_name: fullName }, { onConflict: 'id' });
      if (profileUpsertError) {
        if (createdInvitation) await db.auth.admin.deleteUser(invitedUserId);
        throw profileUpsertError;
      }
      const { error: insertError } = await db.from('organization_members').insert({ organization_id: body.organization_id, user_id: invitedUserId, role });
      if (insertError) {
        if (createdInvitation) await db.auth.admin.deleteUser(invitedUserId);
        throw insertError;
      }
      return Response.json({ ok: true, message: existingProfile ? 'Team member added.' : 'Invitation sent.' }, { headers: { ...cors, 'Cache-Control': 'no-store' } });
    }

    if (body.action === 'update_role') {
      if (!uuid.test(body.user_id || '')) return fail('Choose a team member.');
      if (!['admin', 'member'].includes(body.role)) return fail('Choose Admin or User.');
      if (body.user_id === user.id) return fail('You cannot change your own access level.');
      const { data: target, error: targetError } = await db.from('organization_members').select('role').eq('organization_id', body.organization_id).eq('user_id', body.user_id).maybeSingle();
      if (targetError) throw targetError;
      if (!target) return fail('That team member could not be found.');
      if (target.role === 'owner') return fail('The organization owner’s role cannot be changed here.');
      const { error: updateError } = await db.from('organization_members').update({ role: body.role }).eq('organization_id', body.organization_id).eq('user_id', body.user_id);
      if (updateError) throw updateError;
      return Response.json({ ok: true, message: 'Access level updated.' }, { headers: { ...cors, 'Cache-Control': 'no-store' } });
    }
    return fail('Unknown team action.');
  } catch (error) {
    console.error('team-management failed', error instanceof Error ? error.message : 'Unknown error');
    return fail(error instanceof Error ? error.message : 'The team action failed.');
  }
});
