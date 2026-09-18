const agencyWorkspace = { clients: [], loading: false, showCreateClient: false, busy: false };

function organizationAdminDashboard() {
  const name = state.profile?.full_name?.trim().split(/\s+/)[0] || 'there';
  const query = state.homeQuery.toLowerCase();
  const templates = state.allTemplates.filter(template => template.status === 'published' && (!query || `${template.name} ${template.description || ''} ${template.library_category || ''}`.toLowerCase().includes(query))).slice(0, 3);
  const recent = state.recentGeneratedAssets;
  return `<section class="dashboard-heading"><div><div class="eyebrow">${html(state.organization.name.toUpperCase())} WORKSPACE</div><h2>Welcome back, ${html(name)}.</h2><p class="muted">Manage approved templates, brand assets, and your organization team.</p></div><label class="dashboard-search"><span aria-hidden="true">⌕</span><input type="search" data-home-search value="${html(state.homeQuery)}" placeholder="Search templates and assets"></label></section>
    <section class="dashboard-metrics"><article class="dashboard-metric"><span class="dashboard-metric-icon">T</span><div><strong>${state.counts.templates}</strong><span>Published templates</span></div></article><article class="dashboard-metric"><span class="dashboard-metric-icon">B</span><div><strong>${state.allBrandAssets.length}</strong><span>Approved brand files</span></div></article><article class="dashboard-metric"><span class="dashboard-metric-icon">U</span><div><strong>${state.counts.members}</strong><span>Team members</span></div></article><article class="dashboard-metric"><span class="dashboard-metric-icon">D</span><div><strong>${state.organizationAssetCount}</strong><span>Generated files</span></div></article></section>
    <section class="organization-dashboard-grid"><div><article class="dashboard-panel"><div class="dashboard-panel-heading"><h3>Popular templates</h3><button type="button" onclick="show('templates')">View all →</button></div>${templates.length?`<div class="popular-template-grid">${templates.map(template=>`<article class="popular-template"><div class="popular-template-art"><strong>${html(template.name)}</strong></div><div class="popular-template-body"><strong>${html(template.name)}</strong><small>${html(template.library_category || 'General')} · PDF</small><button class="btn" data-personalize-template="${template.id}">Use Template</button></div></article>`).join('')}</div>`:`<div class="agency-empty"><h3>Your first template belongs here</h3><p class="muted">Upload, configure, test, and publish an approved design for the team.</p><button class="btn" onclick="show('templates')">Add a Template</button></div>`}</article>
    <article class="dashboard-panel" style="margin-top:16px"><div class="dashboard-panel-heading"><h3>Recent files</h3><button type="button" onclick="show('downloads')">View downloads →</button></div>${recent.length?`<div class="recent-file-list">${recent.map(asset=>`<div class="recent-file"><strong>${html(asset.templates?.name || 'Generated asset')}</strong><span class="pill">${html(asset.output_format.toUpperCase())}</span><small>${new Date(asset.created_at).toLocaleDateString()}</small></div>`).join('')}</div>`:'<p class="muted">Generated files will appear here as your team uses published templates.</p>'}</article></div>
    <aside class="dashboard-panel"><div class="dashboard-panel-heading"><h3>Quick actions</h3></div><div class="quick-actions"><button class="quick-action primary" onclick="show('templates')"><span>Create from a template</span><span>→</span></button><button class="quick-action" onclick="show('brandkit')"><span>Browse brand assets</span><span>→</span></button><button class="quick-action" onclick="show('team')"><span>Invite a team member</span><span>→</span></button><button class="quick-action" onclick="show('settings')"><span>Organization settings</span><span>→</span></button></div></aside></section>`;
}

userDashboardView = function() {
  const name = state.profile?.full_name?.trim().split(/\s+/)[0] || 'there';
  const query = state.homeQuery.toLowerCase();
  const templates = state.templates.filter(template => !query || `${template.name} ${template.description || ''} ${template.library_category || ''}`.toLowerCase().includes(query)).slice(0, 3);
  return `<section class="dashboard-heading"><div><div class="eyebrow">YOUR WORKSPACE</div><h2>Welcome back, ${html(name)}.</h2><p class="muted">Create on-brand materials and access everything approved for you.</p></div><label class="dashboard-search"><span aria-hidden="true">⌕</span><input type="search" data-home-search value="${html(state.homeQuery)}" placeholder="Search templates and assets"></label></section>
    <section class="dashboard-metrics"><article class="dashboard-metric"><span class="dashboard-metric-icon">T</span><div><strong>${state.counts.templates}</strong><span>Templates available</span></div></article><article class="dashboard-metric"><span class="dashboard-metric-icon">B</span><div><strong>${state.brandAssets.length}</strong><span>Approved brand files</span></div></article><article class="dashboard-metric"><span class="dashboard-metric-icon">★</span><div><strong>${state.personalItems.length}</strong><span>Saved to My Library</span></div></article><article class="dashboard-metric"><span class="dashboard-metric-icon">D</span><div><strong>${state.userAssetCount}</strong><span>Your generated files</span></div></article></section>
    <section class="organization-dashboard-grid"><div><article class="dashboard-panel"><div class="dashboard-panel-heading"><h3>Ready for you</h3><button type="button" onclick="show('templates')">View all templates →</button></div>${templates.length?`<div class="popular-template-grid">${templates.map(template=>`<article class="popular-template"><div class="popular-template-art"><strong>${html(template.name)}</strong></div><div class="popular-template-body"><strong>${html(template.name)}</strong><small>${html(template.library_category || 'General')} · PDF</small><button class="btn" data-personalize-template="${template.id}">Use Template</button></div></article>`).join('')}</div>`:`<div class="agency-empty"><h3>No approved templates yet</h3><p class="muted">Your organization’s administrators are still preparing the library.</p></div>`}</article>
    <article class="dashboard-panel" style="margin-top:16px"><div class="dashboard-panel-heading"><h3>Recent files</h3><button type="button" onclick="show('downloads')">My downloads →</button></div>${state.recentGeneratedAssets.length?`<div class="recent-file-list">${state.recentGeneratedAssets.map(asset=>`<div class="recent-file"><strong>${html(asset.templates?.name || 'Generated asset')}</strong><span class="pill">${html(asset.output_format.toUpperCase())}</span><small>${new Date(asset.created_at).toLocaleDateString()}</small></div>`).join('')}</div>`:'<p class="muted">Files you generate from approved templates will appear here.</p>'}</article></div>
    <aside><article class="dashboard-panel"><div class="dashboard-panel-heading"><h3>Quick actions</h3></div><div class="quick-actions"><button class="quick-action primary" onclick="show('templates')"><span>Create from Template</span><span>→</span></button><button class="quick-action" onclick="show('brandkit')"><span>Browse Brand Assets</span><span>→</span></button><button class="quick-action" onclick="show('mylibrary')"><span>Open My Library</span><span>→</span></button><button class="quick-action" onclick="show('downloads')"><span>View My Downloads</span><span>→</span></button></div></article><article class="dashboard-panel" style="margin-top:16px"><h3>Brand assets</h3><p class="muted">Official logos, guidelines, icons, and production files approved by ${html(state.organization.name)}.</p><button class="btn outline" onclick="show('brandkit')">Open Brand Library</button></article></aside></section>`;
};

function agencyClientOrganization(relationship) {
  return Array.isArray(relationship.organizations) ? relationship.organizations[0] : relationship.organizations;
}

async function loadAgencyData() {
  if (state.organization?.organization_type !== 'partner') { agencyWorkspace.clients = []; return; }
  agencyWorkspace.loading = true;
  const { data, error } = await sb.from('organization_relationships').select('id,status,created_at,client_organization_id,organizations!organization_relationships_client_organization_id_fkey(id,name,slug,website,industry,team_size,primary_color,secondary_color,background_color)').eq('managing_organization_id', state.organization.id).order('created_at', {ascending:false});
  agencyWorkspace.loading = false;
  if (error) throw error;
  const relationships = data || [];
  if (!relationships.length) { agencyWorkspace.clients = []; return; }
  const { data: grants, error: grantError } = await sb.from('organization_access_grants').select('relationship_id,can_view,can_manage_templates,can_manage_brand,can_manage_members,can_manage_settings,can_review_approvals').eq('user_id', state.userId).in('relationship_id', relationships.map(relationship => relationship.id));
  if (grantError) throw grantError;
  const grantsByRelationship = new Map((grants || []).map(grant => [grant.relationship_id, grant]));
  agencyWorkspace.clients = relationships.map(relationship => ({...relationship, access:grantsByRelationship.get(relationship.id) || null}));
}

function agencyClientRow(relationship) {
  const client = agencyClientOrganization(relationship);
  const initial = (client?.name || 'C').trim().slice(0,1).toUpperCase();
  const available = relationship.status === 'active' && relationship.access?.can_view;
  return `<article class="agency-client-card"><span class="client-mark">${html(initial)}</span><div><strong>${html(client?.name || 'Client organization')}</strong><small>${html(client?.industry || 'Industry not set')}${client?.website?` · ${html(client.website)}`:''}</small></div><span class="status-dot ${relationship.status === 'active' ? '' : 'paused'}">${html(relationship.status)}</span><button class="btn outline" type="button" data-client-details="${relationship.id}" ${available?'':'disabled'}>${available?'Manage client':'Access not assigned'}</button></article>`;
}

function agencyDashboardView() {
  const firstName = state.profile?.full_name?.trim().split(/\s+/)[0] || 'there';
  const activeClients = agencyWorkspace.clients.filter(client => client.status === 'active');
  return `<section class="dashboard-heading"><div><div class="agency-badge">PARTNER WORKSPACE</div><h2>Welcome back, ${html(firstName)}.</h2><p class="muted">Manage client accounts and your agency’s own templates, assets, and team.</p></div><button class="btn" type="button" data-open-add-client>+ Add Client</button></section>
    <section class="dashboard-metrics"><article class="dashboard-metric"><span class="dashboard-metric-icon">C</span><div><strong>${agencyWorkspace.clients.length}</strong><span>Total clients</span></div></article><article class="dashboard-metric"><span class="dashboard-metric-icon">U</span><div><strong>${state.counts.members}</strong><span>Agency team members</span></div></article><article class="dashboard-metric"><span class="dashboard-metric-icon">T</span><div><strong>${state.counts.templates}</strong><span>Agency-owned templates</span></div></article><article class="dashboard-metric"><span class="dashboard-metric-icon">A</span><div><strong>${state.organizationAssetCount}</strong><span>Agency files generated</span></div></article></section>
    <section class="agency-dashboard-grid"><article class="dashboard-panel"><div class="dashboard-panel-heading"><h3>Clients</h3><button type="button" onclick="show('clients')">View all →</button></div>${activeClients.length?`<div class="agency-client-list">${activeClients.slice(0,6).map(agencyClientRow).join('')}</div>`:`<div class="agency-empty"><h3>Add your first client</h3><p class="muted">Create an independent client workspace, then assign exactly which agency users may manage it.</p><button class="btn" type="button" data-open-add-client>Add a Client</button></div>`}</article><aside class="agency-summary"><article class="agency-summary-item"><strong>${activeClients.length}</strong><span>Active client workspaces</span></article><article class="agency-summary-item"><strong>${agencyWorkspace.clients.filter(client=>client.status==='paused').length}</strong><span>Paused relationships</span></article><article class="dashboard-panel"><h3>Partner controls</h3><p class="muted">Client data stays owned by each client organization. Access is granted per agency user and can be removed without moving client files.</p><button class="btn outline" onclick="show('team')">Manage Agency Team</button></article></aside></section>`;
}

function clientCreateForm() {
  return `<div class="client-create-layout"><form id="agencyClientForm" class="card settings-form"><div class="eyebrow">NEW CLIENT WORKSPACE</div><h2>Create an independent client</h2><p class="muted">This creates the organization and connects it to ${html(state.organization.name)}. Client ownership remains separate.</p><label for="clientName">Organization name</label><input id="clientName" name="name" maxlength="120" required placeholder="Smith Realty Group"><label for="clientWebsite">Website <span class="muted">(optional)</span></label><input id="clientWebsite" name="website" type="url" maxlength="255" placeholder="https://example.com"><label for="clientIndustry">Industry <span class="muted">(optional)</span></label><input id="clientIndustry" name="industry" maxlength="80" placeholder="Healthcare, franchise, real estate…"><button class="btn" type="submit">Create Client Workspace</button><button class="btn outline" type="button" data-cancel-add-client>Cancel</button><div id="agencyClientMessage" class="form-message" role="status" aria-live="polite"></div></form><aside class="card client-create-note"><div class="eyebrow">HOW ACCESS WORKS</div><h3>The client stays independent</h3><p>VaraHQ creates a separate organization for the client. Your agency receives a scoped management relationship; the client’s templates, files, users, and branding remain attached to that client account.</p></aside></div>`;
}

function clientsView() {
  if (agencyWorkspace.showCreateClient) return clientCreateForm();
  return `<section class="client-page-header"><div><div class="eyebrow">PARTNER MANAGEMENT</div><h2>Clients</h2><p class="muted">Organizations managed by ${html(state.organization.name)}.</p></div><button class="btn" type="button" data-open-add-client>+ Add Client</button></section>${agencyWorkspace.loading?'<div class="card"><p>Loading clients…</p></div>':agencyWorkspace.clients.length?`<div class="agency-client-list">${agencyWorkspace.clients.map(agencyClientRow).join('')}</div>`:`<div class="agency-empty"><h3>No clients yet</h3><p class="muted">Add the first independent organization your agency will manage in VaraHQ.</p><button class="btn" type="button" data-open-add-client>Add Your First Client</button></div>`}`;
}

function managedClientDashboard() {
  const access = state.delegatedAccess?.grant || {};
  const tools = [
    access.can_manage_templates ? `<button class="quick-action primary" onclick="show('templates')"><span>Manage Templates</span><span>→</span></button>` : '',
    access.can_manage_brand ? `<button class="quick-action" onclick="show('brandkit')"><span>Manage Brand Library</span><span>→</span></button>` : '',
    access.can_manage_members ? `<button class="quick-action" onclick="show('team')"><span>Add or Manage Client Employees</span><span>→</span></button>` : '',
    access.can_manage_settings ? `<button class="quick-action" onclick="show('settings')"><span>Client Settings</span><span>→</span></button>` : ''
  ].join('');
  const templates = state.allTemplates.slice(0, 3);
  return `<section class="dashboard-heading"><div><div class="agency-badge">MANAGED CLIENT</div><h2>${html(state.organization.name)}</h2><p class="muted">Manage this client’s templates, brand assets, team, and workspace settings from one place.</p></div><button class="btn outline" type="button" data-return-to-agency>← Agency Dashboard</button></section>
    <section class="dashboard-metrics"><article class="dashboard-metric"><span class="dashboard-metric-icon">T</span><div><strong>${state.allTemplates.length}</strong><span>Total templates</span></div></article><article class="dashboard-metric"><span class="dashboard-metric-icon">B</span><div><strong>${state.allBrandAssets.length}</strong><span>Brand files</span></div></article><article class="dashboard-metric"><span class="dashboard-metric-icon">U</span><div><strong>${state.counts.members}</strong><span>Client team members</span></div></article><article class="dashboard-metric"><span class="dashboard-metric-icon">D</span><div><strong>${state.organizationAssetCount}</strong><span>Generated files</span></div></article></section>
    <section class="organization-dashboard-grid"><div><article class="dashboard-panel"><div class="dashboard-panel-heading"><h3>Client templates</h3>${access.can_manage_templates?'<button type="button" onclick="show(\'templates\')">Manage all →</button>':''}</div>${templates.length?`<div class="popular-template-grid">${templates.map(template=>`<article class="popular-template"><div class="popular-template-art"><strong>${html(template.name)}</strong></div><div class="popular-template-body"><strong>${html(template.name)}</strong><small>${html(template.library_category || 'General')} · ${html(template.status)}</small><button class="btn" type="button" data-open-template="${template.id}">Configure</button></div></article>`).join('')}</div>`:`<div class="agency-empty"><h3>No client templates yet</h3><p class="muted">Upload the client’s first approved master PDF and configure its controlled fields.</p>${access.can_manage_templates?'<button class="btn" onclick="show(\'templates\')">Add a Template</button>':''}</div>`}</article></div><aside class="dashboard-panel"><div class="dashboard-panel-heading"><h3>Client management</h3></div><div class="quick-actions">${tools}</div></aside></section>`;
}

views.clienthome = managedClientDashboard;

async function activateManagedClient(relationship) {
  const client = agencyClientOrganization(relationship);
  if (!client || relationship.status !== 'active' || !relationship.access?.can_view) throw new Error('Client access is not assigned to your agency account.');
  const partnerOrganizationId = state.organization.id;
  state.delegatedAccess = { partnerOrganizationId, relationshipId:relationship.id, grant:relationship.access };
  state.organization = client;
  state.actualIsAdmin = true;
  state.previewAsUser = false;
  state.isAdmin = true;
  state.currentView = 'clienthome';
  state.homeQuery = '';
  state.homeCategory = 'All';
  state.templates = [];
  state.allTemplates = [];
  state.brandAssets = [];
  state.allBrandAssets = [];
  state.personalItems = [];
  state.recentGeneratedAssets = [];
  library.categoryFilter = 'All';
  library.generatedAssets = [];
  organizationAdmin.members = [];
  workflow.template = null;
  workflow.fields = [];
  const organizationId = client.id;
  const [membersResult, assetsResult, userAssetsResult, recentAssetsResult] = await Promise.all([
    sb.from('organization_members').select('*', {count:'exact',head:true}).eq('organization_id', organizationId),
    sb.from('generated_assets').select('*', {count:'exact',head:true}).eq('organization_id', organizationId),
    sb.from('generated_assets').select('*', {count:'exact',head:true}).eq('organization_id', organizationId).eq('user_id', state.userId),
    sb.from('generated_assets').select('id,output_format,created_at,user_id,templates(name)').eq('organization_id', organizationId).order('created_at', {ascending:false}).limit(5)
  ]);
  const error = membersResult.error || assetsResult.error || userAssetsResult.error || recentAssetsResult.error;
  if (error) throw error;
  state.organizationAssetCount = assetsResult.count || 0;
  state.userAssetCount = userAssetsResult.count || 0;
  state.recentGeneratedAssets = recentAssetsResult.data || [];
  state.counts = {templates:0,members:membersResult.count || 0,assets:state.organizationAssetCount};
  await Promise.all([loadTemplates(), loadLibraryState()]);
  applyOrganizationTheme();
  document.getElementById('sidebarOrganization').textContent = client.name;
  document.getElementById('organizationLogoFallback').textContent = client.name;
  document.getElementById('mobileOrganizationFallback').textContent = client.name;
  document.getElementById('organizationEyebrow').textContent = client.name.toUpperCase();
  document.getElementById('managedClientName').textContent = client.name;
  applyRoleView();
  renderWorkspaceSwitcher();
  show('clienthome');
}

async function returnToAgencyWorkspace() {
  const partnerOrganizationId = state.delegatedAccess?.partnerOrganizationId;
  if (!partnerOrganizationId) return;
  document.getElementById('managedClientNotice').classList.add('hidden');
  content.innerHTML = '<div class="card"><p class="muted">Returning to your agency dashboard…</p></div>';
  await activateOrganization(partnerOrganizationId);
  show('clients');
}

views.clients = clientsView;
adminDashboardView = function() {
  return state.organization?.organization_type === 'partner' ? agencyDashboardView() : organizationAdminDashboard();
};

const dashboardApplyRoleView = applyRoleView;
applyRoleView = function() {
  dashboardApplyRoleView();
  const delegated = state.delegatedAccess;
  const nav = Object.fromEntries([...document.querySelectorAll('.nav button')].map(button => [button.dataset.view, button]));
  if (delegated) {
    const access = delegated.grant;
    nav.clients.hidden = true;
    nav.home.textContent = 'Client Overview';
    nav.templates.hidden = !access.can_manage_templates;
    nav.builder.hidden = !access.can_manage_templates;
    nav.team.hidden = !access.can_manage_members;
    nav.settings.hidden = !access.can_manage_settings;
    nav.brandkit.hidden = !access.can_manage_brand;
    nav.mylibrary.hidden = true;
    nav.downloads.hidden = false;
    nav.team.textContent = 'Client Team';
    nav.settings.textContent = 'Client Settings';
    document.querySelector('.side').classList.remove('agency-side');
    document.getElementById('sidebarRole').textContent = 'Managed Client';
    document.getElementById('rolePreviewToggle').classList.add('hidden');
    document.getElementById('previewNotice').classList.add('hidden');
    document.getElementById('managedClientNotice').classList.remove('hidden');
    return;
  }
  const partnerAdmin = state.organization?.organization_type === 'partner' && state.isAdmin;
  document.getElementById('managedClientNotice').classList.add('hidden');
  nav.clients.hidden = !partnerAdmin;
  nav.home.textContent = partnerAdmin ? 'Agency Dashboard' : 'Dashboard';
  nav.team.textContent = partnerAdmin ? 'Agency Team' : 'Team';
  nav.settings.textContent = partnerAdmin ? 'Partner Settings' : 'Settings';
  nav.mylibrary.hidden = partnerAdmin;
  nav.downloads.hidden = partnerAdmin;
  document.querySelector('.side').classList.toggle('agency-side', partnerAdmin);
  if (partnerAdmin) document.getElementById('sidebarRole').textContent = state.membership?.role === 'owner' ? 'Agency Owner' : 'Agency Admin';
};

const dashboardShow = show;
show = function(view) {
  if (state.delegatedAccess) {
    const access = state.delegatedAccess.grant;
    const allowed = {clienthome:true,home:true,templates:access.can_manage_templates,builder:access.can_manage_templates,brandkit:access.can_manage_brand,team:access.can_manage_members,settings:access.can_manage_settings,downloads:true};
    if (!allowed[view]) view = 'clienthome';
    if (view === 'home') view = 'clienthome';
    dashboardShow(view);
    title.textContent = {clienthome:'Client Overview',templates:'Client Templates',builder:'Template Builder',brandkit:'Client Brand Library',team:'Client Team',settings:'Client Settings',downloads:'Client Files'}[view] || 'Client Overview';
    document.querySelectorAll('.nav button').forEach(button => button.classList.toggle('active', button.dataset.view === (view === 'clienthome' ? 'home' : view)));
    return;
  }
  const partnerAdmin = state.organization?.organization_type === 'partner' && state.isAdmin;
  if (view === 'clients' && !partnerAdmin) view = 'home';
  dashboardShow(view);
  if (partnerAdmin && view === 'home') title.textContent = 'Agency Dashboard';
  if (partnerAdmin && view === 'team') title.textContent = 'Agency Team';
  if (partnerAdmin && view === 'settings') title.textContent = 'Partner Settings';
};

async function createAgencyClient(form) {
  if (agencyWorkspace.busy) return;
  agencyWorkspace.busy = true;
  const button = form.querySelector('button[type=submit]');
  const message = document.getElementById('agencyClientMessage');
  button.disabled = true;
  message.className = 'form-message muted';
  message.textContent = 'Creating the independent client workspace…';
  try {
    const { data, error } = await sb.functions.invoke('partner-management', { body: { action:'create_client', partner_organization_id:state.organization.id, name:form.elements.name.value.trim(), website:form.elements.website.value.trim() || null, industry:form.elements.industry.value.trim() || null } });
    if (error) { let detail=error.message; try { detail=(await error.context.json()).error||detail; } catch {} throw new Error(detail); }
    if (data?.error) throw new Error(data.error);
    agencyWorkspace.showCreateClient = false;
    await loadAgencyData();
    show('clients');
  } catch (error) {
    message.className = 'form-message error';
    message.textContent = error.message || 'The client workspace could not be created.';
    button.disabled = false;
  } finally { agencyWorkspace.busy = false; }
}

content.addEventListener('click', async event => {
  if (event.target.closest('[data-open-add-client]')) { agencyWorkspace.showCreateClient = true; show('clients'); return; }
  if (event.target.closest('[data-cancel-add-client]')) { agencyWorkspace.showCreateClient = false; show('clients'); return; }
  if (event.target.closest('[data-return-to-agency]')) { await returnToAgencyWorkspace(); return; }
  const details = event.target.closest('[data-client-details]');
  if (details) {
    const relationship = agencyWorkspace.clients.find(item => item.id === details.dataset.clientDetails);
    if (!relationship) return;
    content.innerHTML = '<div class="card"><p class="muted">Opening the client workspace…</p></div>';
    try { await activateManagedClient(relationship); }
    catch (error) {
      const message = error.message || 'The client workspace could not be opened.';
      await returnToAgencyWorkspace().catch(() => {});
      content.insertAdjacentHTML('afterbegin', `<div class="notice error">${html(message)}</div>`);
    }
  }
});

document.getElementById('exitManagedClient').addEventListener('click', () => returnToAgencyWorkspace().catch(error => {
  content.innerHTML = `<div class="card"><p class="error">${html(error.message || 'The agency dashboard could not be opened.')}</p></div>`;
}));

content.addEventListener('submit', event => {
  if (event.target.id !== 'agencyClientForm') return;
  event.preventDefault();
  createAgencyClient(event.target);
});
