const agencyWorkspace = { clients: [], loading: false, showCreateClient: false, busy: false, query: '', members: [], templates: [], generatedAssets: [], brandAssets: [] };

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
  if (!relationships.length) { agencyWorkspace.clients = []; agencyWorkspace.members = []; agencyWorkspace.templates = []; agencyWorkspace.generatedAssets = []; agencyWorkspace.brandAssets = []; return; }
  const { data: grants, error: grantError } = await sb.from('organization_access_grants').select('relationship_id,can_view,can_manage_templates,can_manage_brand,can_manage_members,can_manage_settings,can_review_approvals').eq('user_id', state.userId).in('relationship_id', relationships.map(relationship => relationship.id));
  if (grantError) throw grantError;
  const grantsByRelationship = new Map((grants || []).map(grant => [grant.relationship_id, grant]));
  agencyWorkspace.clients = relationships.map(relationship => ({...relationship, access:grantsByRelationship.get(relationship.id) || null}));
  const clientIds = agencyWorkspace.clients.filter(relationship => relationship.status === 'active' && relationship.access?.can_view).map(relationship => relationship.client_organization_id);
  if (!clientIds.length) { agencyWorkspace.members = []; agencyWorkspace.templates = []; agencyWorkspace.generatedAssets = []; agencyWorkspace.brandAssets = []; return; }
  const [membersResult, templatesResult, generatedResult, brandResult] = await Promise.all([
    sb.from('organization_members').select('organization_id,user_id,role,created_at').in('organization_id', clientIds),
    sb.from('templates').select('id,organization_id,name,status,library_category,updated_at').in('organization_id', clientIds),
    sb.from('generated_assets').select('id,organization_id,template_id,output_format,created_at').in('organization_id', clientIds).order('created_at', {ascending:false}).limit(500),
    sb.from('brand_assets').select('id,organization_id,size_bytes,category,created_at').in('organization_id', clientIds)
  ]);
  agencyWorkspace.members = membersResult.data || [];
  agencyWorkspace.templates = templatesResult.data || [];
  agencyWorkspace.generatedAssets = generatedResult.data || [];
  agencyWorkspace.brandAssets = brandResult.data || [];
}

function agencyClientRow(relationship) {
  const client = agencyClientOrganization(relationship);
  const initial = (client?.name || 'C').trim().slice(0,1).toUpperCase();
  const available = relationship.status === 'active' && relationship.access?.can_view;
  return `<article class="agency-client-card"><span class="client-mark">${html(initial)}</span><div><strong>${html(client?.name || 'Client organization')}</strong><small>${html(client?.industry || 'Industry not set')}${client?.website?` · ${html(client.website)}`:''}</small></div><span class="status-dot ${relationship.status === 'active' ? '' : 'paused'}">${html(relationship.status)}</span><button class="btn outline" type="button" data-client-details="${relationship.id}" ${available?'':'disabled'}>${available?'Manage client':'Access not assigned'}</button></article>`;
}

function agencyFormatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function agencyClientStats(relationship) {
  const id = relationship.client_organization_id;
  const templates = agencyWorkspace.templates.filter(item => item.organization_id === id);
  const generated = agencyWorkspace.generatedAssets.filter(item => item.organization_id === id);
  const brand = agencyWorkspace.brandAssets.filter(item => item.organization_id === id);
  return { users:agencyWorkspace.members.filter(item => item.organization_id === id).length, templates:templates.length, pending:templates.filter(item => item.status === 'testing').length, generated:generated.length, storage:brand.reduce((sum,item)=>sum + Number(item.size_bytes || 0),0) };
}

function agencyIcon(name) {
  const paths = {
    clients:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 4v16M12 8h5M12 12h5M12 16h3"/>',
    users:'<circle cx="9" cy="8" r="3"/><path d="M3.5 20c.5-4 2.4-6 5.5-6s5 2 5.5 6M16 7.5a2.5 2.5 0 1 1 0 5M16.5 15c2.4.4 3.7 2 4 5"/>',
    approvals:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16.5 9"/>',
    assets:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m5.5 18 4.2-4.4 3 2.8 2.8-3.1 3 4.7"/>',
    storage:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name] || paths.assets}</svg>`;
}

function agencyMetric(icon, value, label, note = '') {
  return `<article class="agency-kpi"><span class="agency-kpi-icon">${agencyIcon(icon)}</span><div><strong>${html(value)}</strong><span>${html(label)}</span>${note?`<small>${html(note)}</small>`:''}</div></article>`;
}

function agencyMonthlyChart() {
  const now = new Date();
  const months = Array.from({length:9}, (_,offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 8 + offset, 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    return {key,label:date.toLocaleDateString(undefined,{month:'short'}),count:0};
  });
  const byKey = new Map(months.map(month => [month.key, month]));
  agencyWorkspace.generatedAssets.forEach(asset => { const date = new Date(asset.created_at); const month = byKey.get(`${date.getFullYear()}-${date.getMonth()}`); if (month) month.count += 1; });
  const total = months.reduce((sum, month) => sum + month.count, 0);
  if (!total) return `<div class="agency-chart-empty">${agencyIcon('assets')}<strong>No generated assets yet</strong><span>Monthly activity will appear after a client creates its first file.</span></div>`;
  const max = Math.max(1, ...months.map(month => month.count));
  return `<div class="agency-bars">${months.map(month=>`<div class="agency-bar-column"><div class="agency-bar-value">${month.count || ''}</div><div class="agency-bar-track"><i style="height:${month.count ? Math.max(8, month.count / max * 100) : 0}%"></i></div><span>${month.label}</span></div>`).join('')}</div>`;
}

function agencyAssetTypes() {
  const counts = {pdf:0,png:0,jpg:0};
  agencyWorkspace.generatedAssets.forEach(asset => { if (counts[asset.output_format] !== undefined) counts[asset.output_format] += 1; });
  const total = counts.pdf + counts.png + counts.jpg;
  if (!total) return `<div class="agency-chart-empty agency-chart-empty-compact">${agencyIcon('approvals')}<strong>No file types to report</strong><span>PDF, PNG, and JPG totals will appear after files are generated.</span></div>`;
  const pdf = total ? counts.pdf / total * 100 : 0;
  const png = total ? counts.png / total * 100 : 0;
  const background = total ? `conic-gradient(#0f4a38 0 ${pdf}%,#3f8f6e ${pdf}% ${pdf+png}%,#8bc3a7 ${pdf+png}% 100%)` : 'conic-gradient(#e5ebe8 0 100%)';
  return `<div class="agency-type-layout"><div class="agency-donut" style="background:${background}"><span><strong>${total}</strong><small>Total</small></span></div><div class="agency-legend"><div><i class="pdf"></i><span>PDF</span><strong>${counts.pdf}</strong></div><div><i class="png"></i><span>PNG</span><strong>${counts.png}</strong></div><div><i class="jpg"></i><span>JPG</span><strong>${counts.jpg}</strong></div></div></div>`;
}

function agencyClientTableRow(relationship) {
  const client = agencyClientOrganization(relationship);
  const stats = agencyClientStats(relationship);
  const available = relationship.status === 'active' && relationship.access?.can_view;
  return `<tr><td><span class="client-table-name"><i>${html((client?.name || 'C').slice(0,1).toUpperCase())}</i><strong>${html(client?.name || 'Client organization')}</strong></span></td><td>${html(client?.industry || 'Not set')}</td><td>${stats.users}</td><td>${stats.templates}</td><td><span class="pending-count ${stats.pending?'has-pending':''}">${stats.pending}</span></td><td>${agencyFormatBytes(stats.storage)}</td><td><span class="client-status ${relationship.status}">${html(relationship.status)}</span></td><td><button class="client-menu" type="button" data-client-details="${relationship.id}" ${available?'':'disabled'} aria-label="Manage ${html(client?.name || 'client')}">•••</button></td></tr>`;
}

function agencyRecentActivity() {
  const clients = new Map(agencyWorkspace.clients.map(relationship => [relationship.client_organization_id, agencyClientOrganization(relationship)?.name || 'Client']));
  const activities = [
    ...agencyWorkspace.generatedAssets.map(asset => ({date:asset.created_at,icon:'↧',title:'Asset generated',detail:`${String(asset.output_format).toUpperCase()} · ${clients.get(asset.organization_id) || 'Client'}`})),
    ...agencyWorkspace.templates.map(template => ({date:template.updated_at,icon:template.status === 'published'?'✓':'T',title:template.status === 'published'?'Template published':'Template updated',detail:`${template.name} · ${clients.get(template.organization_id) || 'Client'}`})),
    ...agencyWorkspace.clients.map(relationship => ({date:relationship.created_at,icon:'+',title:'Client added',detail:clients.get(relationship.client_organization_id) || 'Client'}))
  ].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,7);
  if (!activities.length) return '<div class="agency-activity-empty">Client activity will appear here.</div>';
  return `<div class="agency-activity-list">${activities.map(item=>`<div><i>${item.icon}</i><span><strong>${html(item.title)}</strong><small>${html(item.detail)}</small><time>${new Date(item.date).toLocaleDateString()}</time></span></div>`).join('')}</div>`;
}

function agencyDashboardView() {
  const activeClients = agencyWorkspace.clients.filter(client => client.status === 'active');
  const filteredClients = agencyWorkspace.clients.filter(relationship => { const client = agencyClientOrganization(relationship); return !agencyWorkspace.query || `${client?.name || ''} ${client?.industry || ''}`.toLowerCase().includes(agencyWorkspace.query.toLowerCase()); });
  const pending = agencyWorkspace.templates.filter(template => template.status === 'testing').length;
  const storage = agencyWorkspace.brandAssets.reduce((sum,asset)=>sum + Number(asset.size_bytes || 0),0);
  const totalUsers = agencyWorkspace.members.length;
  const clientPerformance = activeClients.map(relationship => ({relationship,count:agencyClientStats(relationship).generated})).sort((a,b)=>b.count-a.count).slice(0,5);
  const maxClientAssets = Math.max(1,...clientPerformance.map(item=>item.count));
  return `<section class="agency-page-heading"><div><h2>Agency Dashboard</h2><p>Manage all your clients, assets, templates and approvals in one place.</p></div><button class="btn agency-add-client" type="button" data-open-add-client>＋ Add Client</button></section>
    <section class="agency-kpi-grid">${agencyMetric('clients',agencyWorkspace.clients.length,'Total Clients',activeClients.length ? `${activeClients.length} active` : 'Add your first client')}${agencyMetric('users',totalUsers,'Total Client Users',totalUsers ? 'Across managed accounts' : 'No client users yet')}${agencyMetric('approvals',pending,'Pending Approvals',pending ? 'Templates awaiting review' : 'Nothing waiting')}${agencyMetric('assets',agencyWorkspace.generatedAssets.length,'Assets Generated','Across client accounts')}${agencyMetric('storage',agencyFormatBytes(storage),'Storage Used',`${agencyWorkspace.brandAssets.length} tracked files`)}</section>
    <section class="agency-analytics-grid"><article class="agency-card agency-chart-card"><div class="agency-card-heading"><h3>Client Overview</h3><span>Assets Generated</span></div>${agencyMonthlyChart()}</article><article class="agency-card"><div class="agency-card-heading"><h3>Asset Types</h3><span>This month</span></div>${agencyAssetTypes()}</article></section>
    <section class="agency-work-grid"><article class="agency-card agency-clients-card"><div class="agency-card-heading agency-table-heading"><h3>Clients</h3><label><span>⌕</span><input type="search" data-agency-client-search value="${html(agencyWorkspace.query)}" placeholder="Search clients…"></label></div><div class="agency-table-wrap"><table class="agency-client-table"><thead><tr><th>Client</th><th>Industry</th><th>Users</th><th>Templates</th><th>Pending</th><th>Storage</th><th>Status</th><th>Actions</th></tr></thead><tbody>${filteredClients.length?filteredClients.map(agencyClientTableRow).join(''):`<tr><td colspan="8"><div class="agency-table-empty"><strong>No clients yet</strong><span>Add your first client to begin managing their team, templates, and brand.</span><button class="btn" type="button" data-open-add-client>Add Client</button></div></td></tr>`}</tbody></table></div><div class="agency-table-footer"><span>Showing ${filteredClients.length} of ${agencyWorkspace.clients.length} clients</span></div></article><aside class="agency-card agency-activity-card"><div class="agency-card-heading"><h3>Recent Activity</h3><span>Latest</span></div>${agencyRecentActivity()}</aside></section>
    <section class="agency-bottom-grid"><article class="agency-card"><h3>Storage Usage</h3><strong class="agency-storage-total">${agencyFormatBytes(storage)}</strong><span class="muted"> across client brand libraries</span><div class="agency-storage-line"><i style="width:${storage?100:0}%"></i></div><div class="agency-storage-key"><span>Brand files tracked</span><strong>${agencyWorkspace.brandAssets.length}</strong></div></article><article class="agency-card"><h3>Top Clients by Asset Generation</h3>${clientPerformance.length?`<div class="agency-performance">${clientPerformance.map(item=>`<div><span>${html(agencyClientOrganization(item.relationship)?.name || 'Client')}</span><i><b style="width:${item.count/maxClientAssets*100}%"></b></i><strong>${item.count}</strong></div>`).join('')}</div>`:'<p class="muted">Client generation totals will appear here.</p>'}</article><article class="agency-growth-card"><small>PARTNER PROGRAM</small><h3>Help Your Clients<br>Grow Their Brands</h3><p>Deliver professional brand portals while keeping every client workspace separate and secure.</p><button class="btn" type="button" data-open-add-client>Add a New Client →</button></article></section>`;
}

function agencyApprovalsView() {
  const pending = agencyWorkspace.templates.filter(template => template.status === 'testing');
  const clients = new Map(agencyWorkspace.clients.map(relationship => [relationship.client_organization_id, agencyClientOrganization(relationship)?.name || 'Client']));
  return `<section class="agency-page-heading"><div><h2>Approvals</h2><p>Review client templates that have completed testing and are waiting to be published.</p></div></section><article class="agency-card">${pending.length?`<div class="agency-approval-list">${pending.map(template=>`<div><span><strong>${html(template.name)}</strong><small>${html(clients.get(template.organization_id) || 'Client organization')}</small></span><button class="btn outline" type="button" data-open-agency-template="${template.organization_id}" data-template-id="${template.id}">Open Client</button></div>`).join('')}</div>`:'<div class="agency-table-empty"><strong>No pending approvals</strong><span>Templates in testing will appear here.</span></div>'}</article>`;
}

function agencyReportsView() {
  return `<section class="agency-page-heading"><div><h2>Reports</h2><p>Track asset generation across the client organizations you manage.</p></div></section><section class="agency-analytics-grid"><article class="agency-card agency-chart-card"><div class="agency-card-heading"><h3>Client Overview</h3><span>Assets Generated</span></div>${agencyMonthlyChart()}</article><article class="agency-card"><div class="agency-card-heading"><h3>Asset Types</h3><span>All tracked files</span></div>${agencyAssetTypes()}</article></section>`;
}

function agencyStorageView() {
  const storage = agencyWorkspace.brandAssets.reduce((sum,asset)=>sum + Number(asset.size_bytes || 0),0);
  const byType = new Map();
  agencyWorkspace.brandAssets.forEach(asset => byType.set(asset.category, (byType.get(asset.category) || 0) + Number(asset.size_bytes || 0)));
  return `<section class="agency-page-heading"><div><h2>Storage</h2><p>Storage currently tracked across accessible client brand libraries.</p></div></section><section class="agency-kpi-grid storage-kpis">${agencyMetric('storage',agencyFormatBytes(storage),'Tracked Storage')}${agencyMetric('assets',agencyWorkspace.brandAssets.length,'Brand Files')}${agencyMetric('clients',agencyWorkspace.clients.filter(client=>client.access?.can_view).length,'Accessible Clients')}</section><article class="agency-card"><div class="agency-card-heading"><h3>Storage by File Type</h3><span>Brand Library</span></div>${byType.size?`<div class="agency-storage-breakdown">${[...byType.entries()].sort((a,b)=>b[1]-a[1]).map(([type,size])=>`<div><span>${html(type)}</span><strong>${agencyFormatBytes(size)}</strong></div>`).join('')}</div>`:'<div class="agency-table-empty"><strong>No client files yet</strong><span>Uploaded brand files will be included here.</span></div>'}</article>`;
}

views.approvals = agencyApprovalsView;
views.reports = agencyReportsView;
views.storage = agencyStorageView;

function clientCreateForm() {
  return `<div class="client-create-layout"><form id="agencyClientForm" class="card settings-form"><div class="eyebrow">NEW CLIENT WORKSPACE</div><h2>Create an independent client</h2><p class="muted">This creates the organization and connects it to ${html(state.organization.name)}. Client ownership remains separate.</p><label for="clientName">Organization name</label><input id="clientName" name="name" maxlength="120" required placeholder="Smith Realty Group"><label for="clientWebsite">Website <span class="muted">(optional)</span></label><input id="clientWebsite" name="website" type="url" maxlength="255" placeholder="https://example.com"><label for="clientIndustry">Industry <span class="muted">(optional)</span></label><input id="clientIndustry" name="industry" maxlength="80" placeholder="Healthcare, franchise, real estate…"><button class="btn" type="submit">Create Client Workspace</button><button class="btn outline" type="button" data-cancel-add-client>Cancel</button><div id="agencyClientMessage" class="form-message" role="status" aria-live="polite"></div></form><aside class="card client-create-note"><div class="eyebrow">HOW ACCESS WORKS</div><h3>The client stays independent</h3><p>VaraHQ creates a separate organization for the client. Your agency receives a scoped management relationship; the client’s templates, files, users, and branding remain attached to that client account.</p></aside></div>`;
}

function clientsView() {
  if (agencyWorkspace.showCreateClient) return clientCreateForm();
  const filtered = agencyWorkspace.clients.filter(relationship => { const client = agencyClientOrganization(relationship); return !agencyWorkspace.query || `${client?.name || ''} ${client?.industry || ''}`.toLowerCase().includes(agencyWorkspace.query.toLowerCase()); });
  return `<section class="agency-page-heading"><div><h2>Clients</h2><p>Manage the organizations connected to ${html(state.organization.name)}.</p></div><button class="btn agency-add-client" type="button" data-open-add-client>＋ Add Client</button></section>${agencyWorkspace.loading?'<div class="agency-card"><p>Loading clients…</p></div>':`<article class="agency-card agency-clients-card"><div class="agency-card-heading agency-table-heading"><h3>Client Accounts</h3><label><span>⌕</span><input type="search" data-agency-client-search value="${html(agencyWorkspace.query)}" placeholder="Search clients…"></label></div><div class="agency-table-wrap"><table class="agency-client-table"><thead><tr><th>Client</th><th>Industry</th><th>Users</th><th>Templates</th><th>Pending</th><th>Storage</th><th>Status</th><th>Actions</th></tr></thead><tbody>${filtered.length?filtered.map(agencyClientTableRow).join(''):`<tr><td colspan="8"><div class="agency-table-empty"><strong>No clients yet</strong><span>Add the first independent organization your agency will manage in VaraHQ.</span><button class="btn" type="button" data-open-add-client>Add Your First Client</button></div></td></tr>`}</tbody></table></div><div class="agency-table-footer"><span>Showing ${filtered.length} of ${agencyWorkspace.clients.length} clients</span></div></article>`}`;
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
    nav.approvals.hidden = true;
    nav.reports.hidden = true;
    nav.storage.hidden = true;
    nav.team.textContent = 'Client Team';
    nav.settings.textContent = 'Client Settings';
    document.querySelector('.side').classList.remove('agency-side');
    document.getElementById('sidebarRole').textContent = 'Managed Client';
    document.getElementById('rolePreviewToggle').classList.add('hidden');
    document.getElementById('previewNotice').classList.add('hidden');
    document.getElementById('managedClientNotice').classList.remove('hidden');
    document.body.classList.remove('agency-mode');
    document.getElementById('agencyTopbar').classList.add('hidden');
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
  nav.approvals.hidden = !partnerAdmin;
  nav.reports.hidden = !partnerAdmin;
  nav.storage.hidden = !partnerAdmin;
  document.querySelector('.side').classList.toggle('agency-side', partnerAdmin);
  document.body.classList.toggle('agency-mode', partnerAdmin);
  document.getElementById('agencyTopbar').classList.toggle('hidden', !partnerAdmin);
  if (partnerAdmin) {
    document.getElementById('sidebarRole').textContent = state.membership?.role === 'owner' ? 'Agency Owner' : 'Agency Admin';
    const name = state.profile?.full_name || state.profile?.email || 'Agency Admin';
    document.getElementById('agencyAvatar').textContent = name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase();
    document.getElementById('agencyUserName').textContent = name;
    document.getElementById('agencyOrganizationName').textContent = state.organization.name;
    document.getElementById('agencyGlobalSearch').value = agencyWorkspace.query;
  }
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
  if (['approvals','reports','storage'].includes(view) && !partnerAdmin) view = 'home';
  dashboardShow(view);
  if (partnerAdmin && view === 'home') title.textContent = 'Agency Dashboard';
  if (partnerAdmin && view === 'team') title.textContent = 'Agency Team';
  if (partnerAdmin && view === 'settings') title.textContent = 'Partner Settings';
  if (partnerAdmin && view === 'approvals') title.textContent = 'Approvals';
  if (partnerAdmin && view === 'reports') title.textContent = 'Reports';
  if (partnerAdmin && view === 'storage') title.textContent = 'Storage';
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
  const approvalTemplate = event.target.closest('[data-open-agency-template]');
  if (approvalTemplate) {
    const relationship = agencyWorkspace.clients.find(item => item.client_organization_id === approvalTemplate.dataset.openAgencyTemplate);
    if (!relationship) return;
    content.innerHTML = '<div class="card"><p class="muted">Opening the client template…</p></div>';
    try { await activateManagedClient(relationship); await openTemplate(approvalTemplate.dataset.templateId); }
    catch (error) { await returnToAgencyWorkspace().catch(() => {}); content.insertAdjacentHTML('afterbegin', `<div class="notice error">${html(error.message || 'The template could not be opened.')}</div>`); }
    return;
  }
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

let agencySearchTimer;
document.getElementById('agencyGlobalSearch').addEventListener('input', event => {
  clearTimeout(agencySearchTimer);
  const value = event.target.value;
  agencySearchTimer = setTimeout(() => { agencyWorkspace.query = value; show('home'); document.getElementById('agencyGlobalSearch').focus(); }, 160);
});

content.addEventListener('input', event => {
  if (!event.target.matches('[data-agency-client-search]')) return;
  clearTimeout(agencySearchTimer);
  const value = event.target.value;
  const view = state.currentView === 'clients' ? 'clients' : 'home';
  agencySearchTimer = setTimeout(() => { agencyWorkspace.query = value; show(view); document.querySelector('[data-agency-client-search]')?.focus(); }, 160);
});

document.getElementById('exitManagedClient').addEventListener('click', () => returnToAgencyWorkspace().catch(error => {
  content.innerHTML = `<div class="card"><p class="error">${html(error.message || 'The agency dashboard could not be opened.')}</p></div>`;
}));

content.addEventListener('submit', event => {
  if (event.target.id !== 'agencyClientForm') return;
  event.preventDefault();
  createAgencyClient(event.target);
});
