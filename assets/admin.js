const organizationAdmin = { members: [], loadingMembers: false, busy: false };

function readableText(hex) {
  const value = String(hex || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return '#FFFFFF';
  const [r, g, b] = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16));
  return ((r * 299 + g * 587 + b * 114) / 1000) > 150 ? '#1F1F1F' : '#FFFFFF';
}

function applyOrganizationTheme(colors = state.organization || {}) {
  const primary = colors.primary_color || '#0F2D24';
  const secondary = colors.secondary_color || '#7A9B87';
  const background = colors.background_color || '#E8E7E1';
  const root = document.documentElement.style;
  root.setProperty('--g', primary);
  root.setProperty('--s', secondary);
  root.setProperty('--bg', background);
  root.setProperty('--st', background);
  root.setProperty('--on-g', readableText(primary));
}

function settingsLogoOption(asset) {
  return `<article class="logo-option ${asset.is_primary_logo ? 'selected' : ''}">${assetPreview(asset)}<div><strong>${html(asset.name)}</strong><small>${asset.is_primary_logo ? 'Current workspace logo' : html(asset.original_filename)}</small></div>${asset.is_primary_logo ? '<span class="pill">Current</span>' : `<button type="button" class="btn outline" data-settings-logo="${asset.id}">Use this logo</button>`}</article>`;
}

function organizationSettingsView() {
  const org = state.organization;
  const logos = state.allBrandAssets.filter(asset => asset.category === 'logo' && asset.approved);
  return `<div class="settings-grid"><form id="organizationSettingsForm" class="card settings-form"><div class="eyebrow">ORGANIZATION PROFILE</div><h2>Company details and workspace style</h2><p class="muted">These settings appear throughout the workspace for everyone in your organization.</p><label for="organizationName">Organization name</label><input id="organizationName" name="name" type="text" maxlength="120" value="${html(org.name)}" required><label for="organizationWebsite">Website <span class="muted">(optional)</span></label><input id="organizationWebsite" name="website" type="url" maxlength="255" value="${html(org.website || '')}" placeholder="https://example.com"><div class="color-grid"><label>Brand color<input name="primaryColor" type="color" value="${html(org.primary_color || '#0F2D24')}"></label><label>Accent color<input name="secondaryColor" type="color" value="${html(org.secondary_color || '#7A9B87')}"></label><label>Workspace background<input name="backgroundColor" type="color" value="${html(org.background_color || '#E8E7E1')}"></label></div><div class="brand-preview"><span>Workspace preview</span><strong>${html(org.name)}</strong><button type="button">Approved action</button></div><button class="btn" type="submit">Save organization settings</button><div id="organizationSettingsMessage" class="form-message" role="status" aria-live="polite"></div></form><section class="card"><div class="eyebrow">WORKSPACE LOGO</div><h2>Choose the logo your team sees</h2><p class="muted">Select an approved logo from the Brand Library. Upload new official logo files there first.</p><div class="logo-options">${logos.length ? logos.map(settingsLogoOption).join('') : '<p class="muted">No approved logos have been added yet.</p>'}</div><button class="btn outline" type="button" onclick="show('brandkit')">Open Brand Library</button><div id="organizationLogoMessage" class="form-message" role="status" aria-live="polite"></div></section></div>`;
}

function teamMemberRow(member) {
  const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
  const name = profile?.full_name || profile?.email || 'Invited team member';
  const email = profile?.email || '';
  const locked = member.role === 'owner' || member.user_id === state.userId;
  return `<div class="team-row"><div class="member-avatar" aria-hidden="true">${html(name.slice(0, 1).toUpperCase())}</div><div class="member-details"><strong>${html(name)}</strong><span>${html(email)}</span></div>${locked ? `<span class="pill">${member.role === 'owner' ? 'Owner' : member.role}</span>` : `<div class="role-control"><select data-member-role="${member.user_id}" aria-label="Access level for ${html(name)}"><option value="member" ${member.role === 'member' || member.role === 'manager' ? 'selected' : ''}>User</option><option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin</option></select><button type="button" class="btn outline" data-save-member-role="${member.user_id}">Save</button></div>`}</div>`;
}

function teamView() {
  return `<div class="team-layout"><section class="card"><div class="eyebrow">ADD A TEAM MEMBER</div><h2>Invite someone to ${html(state.organization.name)}</h2><p class="muted">They will receive a secure email invitation and join this organization after setting their password.</p><form id="teamInviteForm" class="settings-form"><label for="inviteName">Full name</label><input id="inviteName" name="fullName" type="text" maxlength="120" required><label for="inviteEmail">Work email</label><input id="inviteEmail" name="email" type="email" maxlength="255" required><label for="inviteRole">Access level</label><select id="inviteRole" name="role"><option value="member">User — use approved templates and files</option><option value="admin">Admin — manage templates, branding, and team</option></select><button class="btn" type="submit">Send invitation</button><div id="teamInviteMessage" class="form-message" role="status" aria-live="polite"></div></form></section><section class="card team-list-card"><div class="team-list-heading"><div><div class="eyebrow">TEAM</div><h2>Organization members</h2></div><span class="pill">${state.counts.members}</span></div><div id="teamMemberList">${organizationAdmin.loadingMembers ? '<p class="muted">Loading team…</p>' : organizationAdmin.members.map(teamMemberRow).join('') || '<p class="muted">No team members found.</p>'}</div><div id="teamMessage" class="form-message" role="status" aria-live="polite"></div></section></div>`;
}

views.settings = organizationSettingsView;
views.team = teamView;

async function loadTeamMembers() {
  organizationAdmin.loadingMembers = true;
  if (state.currentView === 'team') content.innerHTML = teamView();
  const { data, error } = await sb.from('organization_members').select('user_id,role,created_at,profiles(full_name,email,title)').eq('organization_id', state.organization.id).order('created_at');
  organizationAdmin.loadingMembers = false;
  if (error) throw error;
  organizationAdmin.members = data || [];
  state.counts.members = organizationAdmin.members.length;
  if (state.currentView === 'team') content.innerHTML = teamView();
}

async function callTeamManagement(body) {
  const { data, error } = await sb.functions.invoke('team-management', { body: { organization_id: state.organization.id, ...body } });
  if (error) {
    let message = error.message;
    try { message = (await error.context.json()).error || message; } catch {}
    throw new Error(message || 'The team action failed.');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

async function saveOrganizationSettings(form) {
  if (organizationAdmin.busy || !state.isAdmin) return;
  organizationAdmin.busy = true;
  const button = form.querySelector('button[type=submit]');
  const message = document.getElementById('organizationSettingsMessage');
  button.disabled = true;
  message.className = 'form-message muted';
  message.textContent = 'Saving organization settings…';
  const values = { name: form.elements.name.value.trim(), website: form.elements.website.value.trim() || null, primary_color: form.elements.primaryColor.value.toUpperCase(), secondary_color: form.elements.secondaryColor.value.toUpperCase(), background_color: form.elements.backgroundColor.value.toUpperCase() };
  try {
    const { data, error } = await sb.from('organizations').update(values).eq('id', state.organization.id).select('id,name,website,industry,team_size,primary_color,secondary_color,background_color').single();
    if (error) throw error;
    state.organization = data;
    applyOrganizationTheme();
    document.getElementById('sidebarOrganization').textContent = data.name;
    document.getElementById('organizationEyebrow').textContent = data.name.toUpperCase();
    document.getElementById('organizationLogoFallback').textContent = data.name;
    document.getElementById('mobileOrganizationFallback').textContent = data.name;
    show('settings');
    const success = document.getElementById('organizationSettingsMessage');
    success.className = 'form-message success';
    success.textContent = 'Organization settings saved.';
  } catch (error) {
    message.className = 'form-message error';
    message.textContent = error.message || 'The settings could not be saved.';
    button.disabled = false;
  } finally { organizationAdmin.busy = false; }
}

content.addEventListener('input', event => {
  const form = event.target.closest('#organizationSettingsForm');
  if (!form || !event.target.matches('input[type=color]')) return;
  applyOrganizationTheme({ primary_color: form.elements.primaryColor.value, secondary_color: form.elements.secondaryColor.value, background_color: form.elements.backgroundColor.value });
});

content.addEventListener('submit', async event => {
  if (event.target.id === 'organizationSettingsForm') { event.preventDefault(); await saveOrganizationSettings(event.target); return; }
  if (event.target.id !== 'teamInviteForm') return;
  event.preventDefault();
  if (organizationAdmin.busy) return;
  organizationAdmin.busy = true;
  const form = event.target;
  const button = form.querySelector('button[type=submit]');
  const message = document.getElementById('teamInviteMessage');
  button.disabled = true;
  message.className = 'form-message muted';
  message.textContent = 'Creating the invitation…';
  try {
    const result = await callTeamManagement({ action: 'invite', full_name: form.elements.fullName.value.trim(), email: form.elements.email.value.trim(), role: form.elements.role.value });
    form.reset();
    await loadTeamMembers();
    const success = document.getElementById('teamInviteMessage');
    success.className = 'form-message success';
    success.textContent = result.message;
  } catch (error) {
    message.className = 'form-message error';
    message.textContent = error.message;
    button.disabled = false;
  } finally { organizationAdmin.busy = false; }
});

content.addEventListener('click', async event => {
  const logoButton = event.target.closest('[data-settings-logo]');
  if (logoButton) {
    logoButton.disabled = true;
    const { error } = await sb.rpc('set_primary_brand_logo', { p_asset_id: logoButton.dataset.settingsLogo });
    if (error) { logoButton.disabled = false; document.getElementById('organizationLogoMessage').textContent = error.message; return; }
    await loadLibraryState();
    show('settings');
    document.getElementById('organizationLogoMessage').className = 'form-message success';
    document.getElementById('organizationLogoMessage').textContent = 'Workspace logo updated.';
    return;
  }
  const roleButton = event.target.closest('[data-save-member-role]');
  if (!roleButton) return;
  roleButton.disabled = true;
  const userId = roleButton.dataset.saveMemberRole;
  const role = document.querySelector(`[data-member-role="${userId}"]`).value;
  const message = document.getElementById('teamMessage');
  try {
    const result = await callTeamManagement({ action: 'update_role', user_id: userId, role });
    await loadTeamMembers();
    const success = document.getElementById('teamMessage');
    success.className = 'form-message success';
    success.textContent = result.message;
  } catch (error) {
    roleButton.disabled = false;
    message.className = 'form-message error';
    message.textContent = error.message;
  }
});

const adminShow = show;
show = function(view) {
  if (view !== 'settings') applyOrganizationTheme();
  adminShow(view);
  if (view === 'team' && state.isAdmin) loadTeamMembers().catch(error => {
    const target = document.getElementById('teamMemberList');
    if (target) target.innerHTML = `<p class="error">${html(error.message)}</p>`;
  });
  if (view === 'settings' && state.isAdmin) hydrateAssetPreviews();
};
