const library = { generatedAssets: [], busy: false, categoryFilter: 'All' };

function personalItem(type, id) {
  const column = {brand_asset:'brand_asset_id', template:'template_id', generated_asset:'generated_asset_id'}[type];
  return state.personalItems.find(item => item[column] === id);
}

function libraryToggleButton(type, id) {
  if (state.delegatedAccess) return '';
  const saved = Boolean(personalItem(type, id));
  return `<button type="button" class="btn outline save-button ${saved?'saved':''}" data-library-type="${type}" data-library-id="${id}" aria-pressed="${saved}">${saved?'★ Saved':'☆ Save'}</button>`;
}

async function loadLibraryState() {
  const [assetsResult, personalResult] = await Promise.all([
    sb.from('brand_assets').select('id,organization_id,name,description,category,library_category,file_path,original_filename,mime_type,size_bytes,approved,is_primary_logo,created_at').eq('organization_id', state.organization.id).order('created_at', {ascending:false}),
    state.delegatedAccess ? Promise.resolve({data:[],error:null}) : sb.from('personal_library_items').select('id,brand_asset_id,template_id,generated_asset_id,created_at').eq('organization_id', state.organization.id).eq('user_id', state.userId).order('created_at', {ascending:false})
  ]);
  if (assetsResult.error || personalResult.error) throw assetsResult.error || personalResult.error;
  state.allBrandAssets = assetsResult.data || [];
  state.brandAssets = state.isAdmin ? [...state.allBrandAssets] : state.allBrandAssets.filter(asset => asset.approved);
  state.personalItems = personalResult.data || [];
  await loadSavedGeneratedAssets();
  await applyOrganizationBranding();
}

async function loadSavedGeneratedAssets() {
  const ids = state.personalItems.map(item => item.generated_asset_id).filter(Boolean);
  if (!ids.length) { library.generatedAssets = []; return; }
  const {data, error} = await sb.from('generated_assets').select('id,file_path,output_format,created_at,templates(name)').in('id', ids);
  if (error) throw error;
  library.generatedAssets = data || [];
}

async function signedBrandUrl(asset, seconds=900, download=false) {
  const {data, error} = await sb.storage.from('brand-library').createSignedUrl(asset.file_path, seconds, download ? {download:asset.original_filename} : undefined);
  if (error) throw error;
  return data.signedUrl;
}

async function applyOrganizationBranding() {
  const primary = state.brandAssets.find(asset => asset.is_primary_logo);
  const logo = document.getElementById('organizationLogo');
  const mobileLogo = document.getElementById('mobileOrganizationLogo');
  const fallback = document.getElementById('organizationLogoFallback');
  const mobileFallback = document.getElementById('mobileOrganizationFallback');
  if (!primary) {
    logo?.classList.add('hidden');
    mobileLogo?.classList.add('hidden');
    fallback?.classList.remove('hidden');
    mobileFallback?.classList.remove('hidden');
    return;
  }
  try {
    const url = await signedBrandUrl(primary, 3600);
    for (const image of [logo, mobileLogo]) {
      if (!image) continue;
      image.src = url;
      image.alt = `${state.organization.name} logo`;
      image.classList.remove('hidden');
    }
    fallback?.classList.add('hidden');
    mobileFallback?.classList.add('hidden');
  } catch (error) {
    console.error('Organization logo could not be loaded', error);
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function assetPreview(asset) {
  if (asset.mime_type.startsWith('image/')) return `<div class="asset-preview" data-asset-preview="${asset.id}"><span>Loading preview…</span></div>`;
  return `<div class="asset-preview asset-file"><strong>${html(asset.category.toUpperCase())}</strong><span>${html(asset.original_filename.split('.').pop()?.toUpperCase() || 'FILE')}</span></div>`;
}

function brandAssetCard(asset) {
  return `<article class="asset-card">${assetPreview(asset)}<div class="asset-body"><div class="template-meta"><strong>${html(asset.name)}</strong><span class="pill">${html(asset.library_category || 'General')}</span></div>${asset.is_primary_logo?'<small class="primary-label">Workspace logo</small>':''}${asset.description?`<p class="muted">${html(asset.description)}</p>`:''}<small class="muted">${html(asset.category)} · ${html(asset.original_filename)} · ${formatBytes(asset.size_bytes)}</small>${state.isAdmin?`<div class="category-editor"><input data-brand-category-input="${asset.id}" list="brandCardCategoryOptions" maxlength="80" value="${html(asset.library_category || 'General')}" aria-label="Category for ${html(asset.name)}"><button type="button" class="btn outline" data-save-brand-category="${asset.id}">Save category</button></div>`:''}<div class="workflow-actions"><button type="button" class="btn" data-brand-download="${asset.id}">Download</button>${libraryToggleButton('brand_asset',asset.id)}${state.isAdmin&&asset.category==='logo'&&!asset.is_primary_logo?`<button type="button" class="btn outline" data-primary-logo="${asset.id}">Use as workspace logo</button>`:''}${state.isAdmin?`<button type="button" class="btn outline danger-button" data-delete-brand="${asset.id}">Delete</button>`:''}</div></div></article>`;
}

function brandLibraryView() {
  const upload = state.isAdmin ? `<section class="card library-upload"><div><div class="eyebrow">ORGANIZATION ASSETS</div><h2>Add an approved brand file</h2><p class="muted">Upload official logos, icons, guidelines, embroidery files, fonts, and other reusable files. Everyone in ${html(state.organization.name)} can view and download them.</p></div><form id="brandAssetForm" class="upload-form"><label for="brandAssetName">Display name</label><input id="brandAssetName" name="name" type="text" maxlength="160" placeholder="Primary green logo" required><label for="brandAssetCategory">File type</label><select id="brandAssetCategory" name="category"><option value="logo">Logo</option><option value="icon">Icon</option><option value="guideline">Brand guideline</option><option value="embroidery">Embroidery file</option><option value="font">Licensed font</option><option value="other">Other</option></select><label for="brandLibraryCategory">Library category</label><input id="brandLibraryCategory" name="libraryCategory" type="text" list="brandUploadCategoryOptions" maxlength="80" value="General" required>${categoryDatalist('brandUploadCategoryOptions')}<label for="brandAssetDescription">Description <span class="muted">(optional)</span></label><textarea id="brandAssetDescription" name="description" maxlength="1000" placeholder="When should the team use this file?"></textarea><label class="file-drop" for="brandAssetFile"><b>Choose an approved file</b><span class="muted"><br>PNG, JPG, SVG, PDF, EPS, AI, DST, PES, EXP, JEF, TTF, or OTF · 50 MB max</span><input id="brandAssetFile" name="file" type="file" accept=".png,.jpg,.jpeg,.svg,.pdf,.eps,.ai,.dst,.pes,.exp,.jef,.ttf,.otf" required></label><label class="check-label"><input name="primary" type="checkbox"> Use this as the workspace logo</label><button class="btn" type="submit">Upload to Brand Library</button><div id="brandAssetMessage" class="form-message" role="status" aria-live="polite"></div></form></section>` : `<div class="notice">These files are approved and managed by your organization’s administrators. Save the ones you use often to My Library.</div>`;
  const categories=[...new Set(state.brandAssets.map(asset=>asset.library_category||'General'))].sort();
  if(library.categoryFilter!=='All'&&!categories.includes(library.categoryFilter))library.categoryFilter='All';
  const filtered=state.brandAssets.filter(asset=>library.categoryFilter==='All'||(asset.library_category||'General')===library.categoryFilter);
  const assets = filtered.length ? `<div class="asset-grid">${filtered.map(brandAssetCard).join('')}</div>` : `<div class="empty"><h3>No files in this category</h3><p class="muted">Choose another category or add an approved file.</p></div>`;
  return `${upload}<div class="library-heading"><div><div class="eyebrow">ASSET LIBRARY</div><h2>Everything approved, ready when your team needs it</h2><p class="muted">Shared with everyone in ${html(state.organization.name)}.</p></div><span class="pill">${state.brandAssets.length} file${state.brandAssets.length===1?'':'s'}</span></div>${categoryButtons(categories,library.categoryFilter,'data-brand-filter')}${assets}${state.isAdmin?categoryDatalist('brandCardCategoryOptions'):''}`;
}

function myLibraryView() {
  const savedAssets = state.personalItems.map(item => ({item, asset:state.brandAssets.find(asset => asset.id === item.brand_asset_id)})).filter(entry => entry.asset);
  const savedTemplates = state.personalItems.map(item => ({item, template:state.templates.find(template => template.id === item.template_id)})).filter(entry => entry.template);
  const savedFiles = state.personalItems.map(item => ({item, asset:library.generatedAssets.find(asset => asset.id === item.generated_asset_id)})).filter(entry => entry.asset);
  const total = savedAssets.length + savedTemplates.length + savedFiles.length;
  if (!total) return `<div class="empty"><h3>Your library is ready</h3><p class="muted">Save organization logos and files, published templates, or files you generate. Only you can see this page.</p><div class="workflow-actions centered"><button class="btn" onclick="show('brandkit')">Browse Brand Library</button><button class="btn outline" onclick="show('templates')">Browse Templates</button></div></div>`;
  return `<p class="muted">Your private shortcuts and generated files. Removing an item here does not delete the organization’s original.</p>
    ${savedAssets.length?`<section class="library-section"><h2>Favorite brand files</h2><div class="asset-grid">${savedAssets.map(({asset})=>brandAssetCard(asset)).join('')}</div></section>`:''}
    ${savedTemplates.length?`<section class="library-section"><h2>Saved templates</h2><div class="templates">${savedTemplates.map(({template})=>`<article class="template"><div class="preview">PDF MASTER</div><div class="body"><div class="template-meta"><strong>${html(template.name)}</strong><span class="pill">${html(template.status)}</span></div><p class="muted">${html(template.description||'')}</p><div class="workflow-actions"><button class="btn" data-personalize-template="${template.id}">Personalize</button>${libraryToggleButton('template',template.id)}</div></div></article>`).join('')}</div></section>`:''}
    ${savedFiles.length?`<section class="library-section"><h2>Saved creations</h2><div class="card">${savedFiles.map(({asset})=>`<div class="download-row"><span>${html(asset.templates?.name||'Template')} · ${html(asset.output_format.toUpperCase())} · ${new Date(asset.created_at).toLocaleString()}</span><span class="row-actions"><button class="btn outline" data-saved-download="${asset.id}">Download</button>${libraryToggleButton('generated_asset',asset.id)}</span></div>`).join('')}</div></section>`:''}`;
}

views.brandkit = brandLibraryView;
views.mylibrary = myLibraryView;

async function hydrateAssetPreviews() {
  const targets = [...document.querySelectorAll('[data-asset-preview]')];
  await Promise.all(targets.map(async target => {
    const asset = state.brandAssets.find(item => item.id === target.dataset.assetPreview);
    if (!asset) return;
    try {
      const url = await signedBrandUrl(asset);
      const image = document.createElement('img');
      image.src = url;
      image.alt = `${asset.name} preview`;
      target.replaceChildren(image);
    } catch { target.textContent = 'Preview unavailable'; }
  }));
}

async function toggleLibraryItem(button) {
  if (library.busy) return;
  library.busy = true;
  button.disabled = true;
  const type = button.dataset.libraryType;
  const id = button.dataset.libraryId;
  const existing = personalItem(type, id);
  try {
    if (existing) {
      const {error} = await sb.from('personal_library_items').delete().eq('id', existing.id);
      if (error) throw error;
    } else {
      const column = {brand_asset:'brand_asset_id', template:'template_id', generated_asset:'generated_asset_id'}[type];
      if (!column) throw new Error('This item cannot be saved.');
      const {error} = await sb.from('personal_library_items').insert({user_id:state.userId, organization_id:state.organization.id, [column]:id});
      if (error) throw error;
    }
    await loadLibraryState();
    show(state.currentView);
  } catch (error) {
    button.disabled = false;
    button.textContent = error.message || 'Try again';
  } finally { library.busy = false; }
}

async function uploadBrandAsset(form) {
  if (!state.isAdmin || library.busy) return;
  const file = form.elements.file.files[0];
  const allowed = ['png','jpg','jpeg','svg','pdf','eps','ai','dst','pes','exp','jef','ttf','otf'];
  const extension = file?.name.split('.').pop()?.toLowerCase();
  const message = document.getElementById('brandAssetMessage');
  if (!file || !allowed.includes(extension)) { message.className='form-message error'; message.textContent='Choose one of the supported file types.'; return; }
  if (file.size > 50 * 1024 * 1024) { message.className='form-message error'; message.textContent='That file is larger than 50 MB.'; return; }
  if (form.elements.primary.checked && form.elements.category.value !== 'logo') { message.className='form-message error'; message.textContent='Only a logo can be used as workspace branding.'; return; }
  library.busy = true;
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  message.className='form-message muted'; message.textContent='Uploading the approved file…';
  const assetId = crypto.randomUUID();
  const path = `${state.organization.id}/${assetId}.${extension}`;
  try {
    const mime = file.type || 'application/octet-stream';
    const {error:uploadError} = await sb.storage.from('brand-library').upload(path, file, {contentType:mime, cacheControl:'3600', upsert:false});
    if (uploadError) throw uploadError;
    const {error:insertError} = await sb.from('brand_assets').insert({id:assetId, organization_id:state.organization.id, name:form.elements.name.value.trim(), description:form.elements.description.value.trim()||null, category:form.elements.category.value, library_category:form.elements.libraryCategory.value.trim(), file_path:path, original_filename:file.name, mime_type:mime, size_bytes:file.size, approved:true, uploaded_by:state.userId});
    if (insertError) { await sb.storage.from('brand-library').remove([path]); throw insertError; }
    if (form.elements.primary.checked) {
      const {error} = await sb.rpc('set_primary_brand_logo', {p_asset_id:assetId});
      if (error) throw error;
    }
    await loadLibraryState();
    show('brandkit');
    const success = document.getElementById('brandAssetMessage');
    if (success) { success.className='form-message success'; success.textContent='The approved file is now available to the organization.'; }
  } catch (error) {
    message.className='form-message error'; message.textContent=error.message||'The file could not be uploaded.';
    button.disabled=false;
  } finally { library.busy=false; }
}

async function downloadBrandAsset(id) {
  const asset = state.brandAssets.find(item => item.id === id);
  if (!asset) return;
  const url = await signedBrandUrl(asset, 300, true);
  const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';link.click();
}

async function downloadSavedAsset(id) {
  const asset = library.generatedAssets.find(item => item.id === id);
  if (!asset) return;
  const {data, error} = await sb.storage.from('generated-assets').createSignedUrl(asset.file_path, 300, {download:true});
  if (error) throw error;
  const link=document.createElement('a');link.href=data.signedUrl;link.target='_blank';link.rel='noopener';link.click();
}

async function setPrimaryLogo(id, button) {
  button.disabled=true;
  const {error}=await sb.rpc('set_primary_brand_logo',{p_asset_id:id});
  if(error){button.disabled=false;button.textContent=error.message;return;}
  await loadLibraryState();
  show('brandkit');
}

async function deleteBrandAsset(id) {
  const asset = state.brandAssets.find(item => item.id === id);
  if (!asset || !confirm(`Delete “${asset.name}” from the organization’s Brand Library?`)) return;
  const {error:rowError} = await sb.from('brand_assets').delete().eq('id', id);
  if (rowError) throw rowError;
  const {error:fileError} = await sb.storage.from('brand-library').remove([asset.file_path]);
  if (fileError) console.error('Brand file cleanup failed', fileError);
  await loadLibraryState();
  show('brandkit');
}

async function saveLibraryCategory(table, id, input) {
  const category=input.value.trim();
  if(!category||category.length>80){input.focus();return;}
  const {error}=await sb.from(table).update({library_category:category}).eq('id',id);
  if(error){input.setCustomValidity(error.message);input.reportValidity();return;}
  input.setCustomValidity('');
  if(table==='brand_assets')await loadLibraryState();else await loadTemplates();
  show(state.currentView);
}

content.addEventListener('submit', event => {
  if (event.target.id !== 'brandAssetForm') return;
  event.preventDefault();
  uploadBrandAsset(event.target);
});

content.addEventListener('click', async event => {
  const brandFilter=event.target.closest('[data-brand-filter]');
  if(brandFilter){library.categoryFilter=brandFilter.dataset.brandFilter;show('brandkit');return;}
  const saveBrandCategory=event.target.closest('[data-save-brand-category]');
  if(saveBrandCategory){const id=saveBrandCategory.dataset.saveBrandCategory;await saveLibraryCategory('brand_assets',id,document.querySelector(`[data-brand-category-input="${id}"]`));return;}
  const saveTemplateCategory=event.target.closest('[data-save-template-category]');
  if(saveTemplateCategory){const id=saveTemplateCategory.dataset.saveTemplateCategory;await saveLibraryCategory('templates',id,document.querySelector(`[data-template-category-input="${id}"]`));return;}
  const save = event.target.closest('[data-library-type]');
  if (save) { await toggleLibraryItem(save); return; }
  const brandDownload = event.target.closest('[data-brand-download]');
  if (brandDownload) { await downloadBrandAsset(brandDownload.dataset.brandDownload); return; }
  const savedDownload = event.target.closest('[data-saved-download]');
  if (savedDownload) { await downloadSavedAsset(savedDownload.dataset.savedDownload); return; }
  const primary = event.target.closest('[data-primary-logo]');
  if (primary) { await setPrimaryLogo(primary.dataset.primaryLogo, primary); return; }
  const remove = event.target.closest('[data-delete-brand]');
  if (remove) { await deleteBrandAsset(remove.dataset.deleteBrand); }
});

const workflowShow = show;
show = function(view) {
  workflowShow(view);
  if (view === 'brandkit' || view === 'mylibrary') hydrateAssetPreviews();
};
