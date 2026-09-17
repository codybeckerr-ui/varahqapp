/* Admin setup and member generation share template identity, never design authority. */
const workflow = { template: null, fields: [], fonts: [], pages: [], warnings: [], selected: 0, values: {}, preview: '', report: null, dirty: false, busy: false, mode: 'builder', fontQuery: '' };
const apiBase = location.protocol === 'file:' ? 'https://varahqapp.vercel.app' : '';
const workflowPublishableKey = 'sb_publishable_R4UOrzo-lb95ExANWotdPw_2VSADYzc';
const html = escapeHtml;
async function templateRequest(action, extra = {}, gateway = false) {
  const {data:{session}} = await sb.auth.getSession();
  if (!session) throw new Error('Please sign in again.');
  const response = await fetch(gateway ? 'https://wzgfzopxltgfkejpofat.supabase.co/functions/v1/template-workflow' : `${apiBase}/api/template`, {
    method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`, ...(gateway ? {apikey: workflowPublishableKey} : {})},
    body:JSON.stringify({action,template_id:workflow.template?.id,...extra})
  });
  let result;
  try { result = await response.json(); } catch { throw new Error('The template service is unavailable. Please try again shortly.'); }
  if (!response.ok || result.error) throw new Error(result.error || 'The template action failed.');
  return result;
}
function workflowMessage(message, error=false) {
  const box = document.getElementById('workflowMessage');
  if(box) { box.className=`form-message ${error?'error':'success'}`; box.textContent=message; box.scrollIntoView({block:'nearest'}); }
}
async function runWorkflow(task) {
  if(workflow.busy) return;
  workflow.busy=true;
  const enabledInputs=[...document.querySelectorAll('#content input:not(:disabled), #content select:not(:disabled), .nav button:not(:disabled)')];
  enabledInputs.forEach(el=>el.disabled=true);
  document.querySelectorAll('[data-workflow]').forEach(b=>b.disabled=true);
  try { await task(); } catch(error) { workflowMessage(error.message,true); }
  finally {enabledInputs.forEach(el=>{if(el.isConnected)el.disabled=false;});workflow.busy=false;document.querySelectorAll('[data-workflow]').forEach(b=>b.disabled=false);updateWorkflowButtons();}
}
function updateWorkflowButtons() {
  const publish=document.getElementById('publishTemplate');
  if(publish) publish.disabled=workflow.busy || workflow.dirty || workflow.template?.status!=='testing';
}
async function openTemplate(id,mode='builder') {
  workflow.mode=mode; workflow.template={id}; workflow.report=null; workflow.dirty=false;
  title.textContent=mode==='builder'?'Configure Template':'Personalize Template';
  content.innerHTML='<div class="card"><p>Opening your template…</p><div id="workflowMessage" role="status"></div></div>';
  try {
    const data=await templateRequest(mode==='builder'?'inspect':'personalize');
    Object.assign(workflow,data,{selected:0,mode,dirty:false});
    workflow.values=data.values || Object.fromEntries(data.fields.map(f=>[f.variable_name, f.data_source?.startsWith('user.') ? data.profile?.[f.data_source.slice(5)] || f.style_metadata?.default_value || '' : f.style_metadata?.default_value || '']));
    state.currentView=mode==='builder'?'builder':'personalize';
    paintWorkflow();
  } catch(error) {workflowMessage(error.message,true);}
}
function fontOptions(field) {
  const selected=field.style_metadata.font_id;
  return `<option value="">Choose a full font…</option>${workflow.fonts.map(f=>`<option value="${html(f.id)}" ${selected===f.id?'selected':''}>${html(f.name)}</option>`).join('')}`;
}
function googleFontSearch() {
  return `<div class="font-search"><label for="googleFontQuery">Find a built-in Google Font</label><div><input id="googleFontQuery" value="${html(workflow.fontQuery)}" maxlength="80" placeholder="Roboto, Lato, Montserrat…"><button type="button" class="btn outline" data-workflow="google-fonts">Search</button></div></div>`;
}
function fieldInput(label,key,type='number',attributes='') {
  const f=workflow.fields[workflow.selected];
  return `<label for="field-${key}">${label}</label><input id="field-${key}" data-rule="${key}" type="${type}" value="${html(f[key])}" ${attributes}>`;
}
function fieldInspector() {
  const f=workflow.fields[workflow.selected];
  if(!f) return '<p>No variables found. Add a text field over a blank area, or export a PDF containing {{FULL_NAME}} placeholders.</p>';
  const locked=workflow.template.status==='published';
  return `<fieldset ${locked?'disabled':''}><legend>${html(f.label)}</legend>
    ${fieldInput('Label','label','text','maxlength="120"')}
    <label for="field-source">Data source</label><select id="field-source" data-rule="data_source">${[['custom','Custom value'],['user.full_name','Profile · Full name'],['user.title','Profile · Title'],['user.email','Profile · Email'],['user.phone','Profile · Phone'],['user.website','Profile · Website']].map(([v,l])=>`<option value="${v}" ${f.data_source===v?'selected':''}>${l}</option>`).join('')}</select>
    <p class="muted">Original font: ${html(f.style_metadata.source_font || f.font_family)}</p>
    <label for="field-font">Approved full font</label><select id="field-font" data-meta="font_id">${fontOptions(f)}</select>
    ${f.style_metadata.font_match==='exact'?'<p class="form-message success">Exact Google Fonts family and style detected from the PDF. Review it before publishing.</p>':''}
    ${googleFontSearch()}
    ${workflow.fontsStatus && workflow.fontsStatus!=='connected'?`<p class="form-message error">${html(workflow.fontsStatus)}</p>`:''}
    <div class="rule-grid">${fieldInput('Size (pt)','font_size','number','step="0.1" min="3" max="200"')}${fieldInput('Minimum (pt)','min_font_size','number','step="0.1" min="3" max="200"')}</div>
    ${fieldInput('Text color','text_color','color')}
    ${f.style_metadata.source_effect?`<label class="check-label"><input type="checkbox" data-meta="effect_approved" ${f.style_metadata.effect_approved?'checked':''}> Approve replacing the original text effect with this solid color</label>`:''}
    <label for="field-align">Alignment</label><select id="field-align" data-rule="alignment">${['left','center','right'].map(v=>`<option ${f.alignment===v?'selected':''}>${v}</option>`).join('')}</select>
    <label for="field-overflow">When text is too long</label><select id="field-overflow" data-rule="overflow_rule">${[['reject','Reject'],['shrink','Shrink to minimum'],['wrap','Wrap within bounds']].map(([v,l])=>`<option value="${v}" ${f.overflow_rule===v?'selected':''}>${l}</option>`).join('')}</select>
    ${fieldInput('Maximum lines','max_lines','number','min="1" max="10" step="1"')}
    <details><summary>Position & bounds (points)</summary><div class="rule-grid">${['x','y','width','height'].map(k=>fieldInput(k.toUpperCase(),k,'number','step="0.1" min="0"')).join('')}</div></details>
    <label class="check-label"><input type="checkbox" data-rule="required" ${f.required?'checked':''}> Required</label>
    <label class="check-label"><input type="checkbox" data-rule="user_editable" ${f.user_editable?'checked':''}> Team members may edit this value</label>
    <label for="field-default">Default value</label><input id="field-default" data-meta="default_value" value="${html(f.style_metadata.default_value || '')}" maxlength="1000">
    ${f.style_metadata.manual?'<button type="button" class="btn outline" data-workflow="remove">Remove field</button>':''}
    </fieldset>`;
}
function testValueInputs(admin=true) {
  const unique=[...new Map(workflow.fields.map(f=>[f.variable_name,f])).values()];
  return unique.map(f=>`<div><label for="value-${html(f.variable_name)}">${html(f.label)}${f.required?' *':''}</label><input id="value-${html(f.variable_name)}" data-value="${html(f.variable_name)}" value="${html(workflow.values[f.variable_name] || '')}" maxlength="1000" ${!admin&&!f.user_editable?'disabled':''} ${f.required?'required':''}>${!admin&&!f.user_editable?'<small class="muted">Set by your profile or administrator</small>':''}</div>`).join('');
}
function canvasView() {
  const page=workflow.pages[0];
  return `<div class="template-canvas" id="templateCanvas"><img src="data:image/png;base64,${workflow.preview}" alt="Uploaded master PDF">
    ${page?workflow.fields.map((f,i)=>f.page_number!==1?'':`<button class="field-box ${workflow.selected===i?'selected':''}" data-select-field="${i}" aria-label="Select ${html(f.label)}" style="left:${f.x/page.width*100}%;top:${f.y/page.height*100}%;width:${f.width/page.width*100}%;height:${f.height/page.height*100}%"><span>${html(f.label)}</span><i data-resize="${i}" aria-hidden="true"></i></button>`).join(''):''}</div>`;
}
function builderView() {
  if(!workflow.template || !workflow.template.name) return `<div class="card"><h3>Choose a template to configure</h3><p>Open an uploaded draft from Templates to set its variables and test it.</p><button class="btn" onclick="show('templates')">Open Templates</button></div>`;
  const t=workflow.template, published=t.status==='published';
  return `<div class="workflow-top"><div><h2>${html(t.name)} <span class="pill">${html(t.status)}</span></h2><p class="muted">Configure fields → Save → Test → Publish</p></div><button class="btn outline" onclick="show('templates')">Back to Templates</button></div>
    <div id="workflowMessage" class="form-message" role="status" aria-live="polite"></div>
    ${published?'<div class="notice">This template is published. Return it to draft to change design rules. Existing downloads remain available.</div>':''}
    ${workflow.warnings?.length?`<details class="notice"><summary>Review ${workflow.warnings.length} setup note${workflow.warnings.length===1?'':'s'}</summary><ul>${workflow.warnings.map(w=>`<li>${html(w)}</li>`).join('')}</ul></details>`:''}
    <div class="editor-grid"><section class="card"><p class="muted">Select a field. Drag its box to move it or its corner to resize its approved area.</p>${canvasView()}<div class="field-tabs">${workflow.fields.map((f,i)=>`<button class="btn ${workflow.selected===i?'':'outline'}" data-select-field="${i}">${html(f.label)}${f.style_metadata.font_id?'':' · Needs font'}</button>`).join('')}</div><div class="workflow-actions">${published?'<button class="btn outline" data-workflow="unpublish">Return to Draft</button>':'<button class="btn outline" data-workflow="detect">Detect Variables</button><button class="btn outline" data-workflow="add">Add Text Field</button>'}</div></section><aside class="inspector">${fieldInspector()}</aside></div>
    ${!published?`<section class="card font-upload"><h3>Add a licensed full font</h3><p class="muted">Upload a TTF or OTF to preserve a font that is not in the approved list.</p><input id="fontFile" type="file" accept=".ttf,.otf"><label class="check-label"><input id="fontLicense" type="checkbox"> I have permission to use and embed this font.</label><button class="btn outline" data-workflow="font">Upload Font</button></section>`:''}
    <section class="card test-panel"><h3>Test personalized content</h3><div class="value-grid">${testValueInputs()}</div><div class="workflow-actions">${published?`<button class="btn" data-workflow="personalize">Personalize & Download</button>`:`<button class="btn outline" data-workflow="save">Save Draft</button><button class="btn" data-workflow="test">Save & Test Template</button><button id="publishTemplate" class="btn" data-workflow="publish" ${t.status!=='testing'||workflow.dirty?'disabled':''}>Publish Template</button>`}</div><div id="testResults">${testResults()}</div></section>`;
}
function testResults() {
  if(!workflow.report) return '<p class="muted">A successful test enables publishing. Any saved field change requires a new test.</p>';
  return `<div class="notice"><b>Server test passed.</b> ${workflow.report.elapsed_ms} ms including source and font loading.<p>Stress tests safely reject content outside the approved rules:</p><ul>${workflow.report.stress.map(s=>`<li>${html(s.name)} — ${s.result==='fits'?'fits':html(s.message)}</li>`).join('')}</ul></div>${workflow.testPreview?`<img class="test-preview" alt="Server-rendered personalized test" src="data:image/png;base64,${workflow.testPreview}">`:''}`;
}
function personalizationView() {
  return `<div class="workflow-top"><h2>${html(workflow.template.name)}</h2><button class="btn outline" onclick="show('templates')">Back to Templates</button></div><div id="workflowMessage" role="status" aria-live="polite"></div><div class="editor-grid"><section class="card"><img id="personalizedPreview" class="test-preview" src="data:image/png;base64,${workflow.preview}" alt="Template preview"><p class="muted">Preview uses the same server renderer as your download.</p></section><section class="inspector">${testValueInputs(false)}<label for="outputFormat">Download format</label><select id="outputFormat"><option value="pdf">PDF</option><option value="png">PNG · 300 DPI</option><option value="jpg">JPG · 300 DPI</option></select><div class="workflow-actions"><button class="btn outline" data-workflow="preview">Preview</button><button class="btn" data-workflow="generate">Generate & Download</button></div><div id="downloadResult" role="status"></div></section></div>`;
}
function paintWorkflow() { title.textContent=workflow.mode==='builder'?'Template Builder':'Personalize';content.innerHTML=workflow.mode==='builder'?builderView():personalizationView();updateWorkflowButtons(); }
views.builder=builderView;
views.personalize=personalizationView;
templateLibrary=function() {
 if(!state.templates.length) return '<div class="empty"><h3>No templates yet</h3><p>Upload a master PDF to begin.</p></div>';
 return `<div class="templates">${state.templates.map(t=>`<article class="template"><div class="preview">PDF MASTER</div><div class="body"><div class="template-meta"><strong>${html(t.name)}</strong><span class="pill">${html(t.status)}</span></div><p class="muted">${html(t.description || '')}</p><div class="workflow-actions">${state.isAdmin?`<button class="btn outline" data-open-template="${t.id}">${t.status==='published'?'View Configuration':'Configure & Publish'}</button>`:''}${t.status==='published'?`<button class="btn" data-personalize-template="${t.id}">Personalize</button>${libraryToggleButton('template',t.id)}`:''}</div></div></article>`).join('')}</div>`;
};
function markDirty() { workflow.dirty=true;workflow.report=null;workflow.testPreview='';updateWorkflowButtons(); }
content.addEventListener('input',event=>{
 const el=event.target;
 if(el.dataset.value) {workflow.values[el.dataset.value]=el.value;return;}
 const f=workflow.fields[workflow.selected]; if(!f || workflow.template.status==='published') return;
 const key=el.dataset.rule || el.dataset.meta;if(!key) return;
 const value=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;
 if(el.dataset.meta) f.style_metadata[key]=value;else f[key]=value;
 if(key==='font_id') f.font_family=workflow.fonts.find(font=>font.id===value)?.name || f.font_family;
 markDirty();
 if(['x','y','width','height'].includes(key)) {const box=content.querySelector(`.field-box[data-select-field="${workflow.selected}"]`),p=workflow.pages[f.page_number-1]; if(box&&p) Object.assign(box.style,{left:f.x/p.width*100+'%',top:f.y/p.height*100+'%',width:f.width/p.width*100+'%',height:f.height/p.height*100+'%'});}
});
content.addEventListener('click',event=>{
 const open=event.target.closest('[data-open-template]');if(open){openTemplate(open.dataset.openTemplate);return;}
 const personalize=event.target.closest('[data-personalize-template]');if(personalize){openTemplate(personalize.dataset.personalizeTemplate,'personalize');return;}
 const selected=event.target.closest('[data-select-field]');if(selected){workflow.selected=Number(selected.dataset.selectField);paintWorkflow();return;}
 const action=event.target.closest('[data-workflow]')?.dataset.workflow;if(!action)return;
 runWorkflow(async()=>{
  if(action==='save'||action==='test') {
   workflowMessage(action==='test'?'Saving fields and rendering your test…':'Saving fields…');
   const saved=await templateRequest('save',{revision:workflow.template.revision,fields:workflow.fields});
   Object.assign(workflow.template,saved); workflow.dirty=false;workflow.report=null;
   if(action==='test') {
    const tested=await templateRequest('test',{revision:saved.revision,values:workflow.values},true);
    workflow.template.status='testing';workflow.report=tested.report;workflow.testPreview=tested.preview;
   }
   await loadTemplates();paintWorkflow();workflowMessage(action==='test'?'Test passed. Review the preview, then publish when ready.':'Draft saved.');
  } else if(action==='publish'||action==='unpublish') {
   if(action==='publish'&&workflow.dirty)throw new Error('Save and test your changes before publishing.');
   await templateRequest(action,{revision:workflow.template.revision},true);await loadTemplates();
   if(action==='publish'){await openTemplate(workflow.template.id,'personalize');workflowMessage('Template published. Your team can now personalize and download it.');}
   else await openTemplate(workflow.template.id);
  } else if(action==='detect') {
   if(workflow.fields.length && workflow.dirty)throw new Error('Save your field changes before detecting again.');
   const result=await templateRequest('detect');Object.assign(workflow,{fields:result.fields,warnings:result.warnings,selected:0});markDirty();paintWorkflow();
  } else if(action==='add') {
   const p=workflow.pages[0];let n=1;while(workflow.fields.some(f=>f.variable_name===`CUSTOM_${n}`))n++;
   workflow.fields.push({variable_name:`CUSTOM_${n}`,label:`Custom ${n}`,field_type:'text',data_source:'custom',page_number:1,x:10,y:10,width:Math.min(100,p.width-20),height:20,font_family:'OpenSans-Regular',font_weight:'Regular',font_size:10,min_font_size:8,text_color:'#1f1f1f',alignment:'left',overflow_rule:'shrink',max_lines:1,required:false,user_editable:true,style_metadata:{manual:true,font_id:'OpenSans-Regular',default_value:''}});
   workflow.selected=workflow.fields.length-1;markDirty();paintWorkflow();
  } else if(action==='remove') {workflow.fields.splice(workflow.selected,1);workflow.selected=0;markDirty();paintWorkflow();}
  else if(action==='font') {
   const file=document.getElementById('fontFile').files[0];if(!file)throw new Error('Choose a TTF or OTF file.');
   if(!document.getElementById('fontLicense').checked)throw new Error('Confirm you have permission to use and embed this font.');
   if(file.size>5*1024*1024)throw new Error('Font files must be at most 5 MB.');
   const buffer=new Uint8Array(await file.arrayBuffer());let binary='';for(const byte of buffer)binary+=String.fromCharCode(byte);
   const result=await templateRequest('font_upload',{organization_id:state.organization.id,font:btoa(binary),licensed:true},true);
   workflow.fonts.push(result);paintWorkflow();workflowMessage(`${result.name} uploaded. Select it for the matching fields.`);
  } else if(action==='google-fonts') {
   const query=document.getElementById('googleFontQuery')?.value.trim() || '';
   const result=await templateRequest('font_catalog',{organization_id:state.organization.id,query,limit:80});
   workflow.fontQuery=query;
   const known=new Set(workflow.fonts.map(f=>f.id));for(const font of result.fonts)if(!known.has(font.id))workflow.fonts.push(font);
   paintWorkflow();workflowMessage(`${result.fonts.length} Google Font style${result.fonts.length===1?'':'s'} added to the font list.`);
  } else if(action==='personalize') {await openTemplate(workflow.template.id,'personalize');}
  else if(action==='preview'||action==='generate') {
   const values=Object.fromEntries(workflow.fields.filter(f=>f.user_editable).map(f=>[f.variable_name,workflow.values[f.variable_name]||'']));
   workflowMessage(action==='preview'?'Rendering preview…':'Generating your file…');
   if(action==='preview') {
    const result=await templateRequest('generate',{values,format:'png'});
    document.getElementById('personalizedPreview').src=`data:image/png;base64,${result.file}`;workflowMessage(`Preview ready (${result.elapsed_ms} ms).`);
   } else {
    const result=await templateRequest('generate',{values,format:document.getElementById('outputFormat').value},true);
    const link=document.createElement('a');link.className='btn';link.href=result.url;link.target='_blank';link.rel='noopener';link.textContent=`Download ${result.format.toUpperCase()}`;
    document.getElementById('downloadResult').replaceChildren(link);workflowMessage(`File ready (${result.elapsed_ms} ms). Saved in Downloads.`);state.counts.assets++;
   }
  }
 });
});
let drag=null;
content.addEventListener('pointerdown',event=>{
 const box=event.target.closest('.field-box');if(!box||workflow.template.status==='published')return;
 const index=Number(box.dataset.selectField),f=workflow.fields[index];
 drag={index,startX:event.clientX,startY:event.clientY,original:{...f},resize:!!event.target.dataset.resize||event.target.hasAttribute('data-resize'),bounds:document.getElementById('templateCanvas').getBoundingClientRect(),moved:false};
 box.setPointerCapture(event.pointerId);
});
content.addEventListener('pointermove',event=>{
 if(!drag)return;const f=workflow.fields[drag.index],p=workflow.pages[f.page_number-1],dx=(event.clientX-drag.startX)*p.width/drag.bounds.width,dy=(event.clientY-drag.startY)*p.height/drag.bounds.height;
 if(Math.abs(dx)+Math.abs(dy)<.5)return;drag.moved=true;
 if(drag.resize){f.width=Math.max(5,Math.min(p.width-f.x,drag.original.width+dx));f.height=Math.max(5,Math.min(p.height-f.y,drag.original.height+dy));}
 else {f.x=Math.max(0,Math.min(p.width-f.width,drag.original.x+dx));f.y=Math.max(0,Math.min(p.height-f.height,drag.original.y+dy));}
 const box=event.target.closest('.field-box');if(box)Object.assign(box.style,{left:f.x/p.width*100+'%',top:f.y/p.height*100+'%',width:f.width/p.width*100+'%',height:f.height/p.height*100+'%'});
});
content.addEventListener('pointerup',()=>{if(drag?.moved){workflow.selected=drag.index;markDirty();paintWorkflow();}drag=null;});
views.downloads=()=>'<div class="card"><h3>Your downloads</h3><div id="downloadList">Loading saved files…</div></div>';
const originalShow=show;
show=function(view){originalShow(view);if(view==='downloads')loadDownloads();if(view==='builder')updateWorkflowButtons();};
async function loadDownloads(){
 const target=document.getElementById('downloadList');
 let query=sb.from('generated_assets').select('id,file_path,output_format,created_at,templates(name)').eq('organization_id',state.organization.id).order('created_at',{ascending:false}).limit(50);
 if(!state.isAdmin)query=query.eq('user_id',state.userId);
 const {data,error}=await query;
 if(!target?.isConnected)return;if(error){target.textContent=error.message;return;}
 target.innerHTML=data.length?data.map(a=>`<div class="download-row"><span>${html(a.templates?.name||'Template')} · ${html(a.output_format.toUpperCase())} · ${new Date(a.created_at).toLocaleString()}</span><span class="row-actions"><button class="btn outline" data-download-id="${a.id}">Download</button>${libraryToggleButton('generated_asset',a.id)}</span></div>`).join(''):'No generated files yet. Open a published template to create one.';
 target.onclick=async event=>{const id=event.target.dataset.downloadId;if(!id)return;const asset=data.find(a=>a.id===id);const {data:link,error}=await sb.storage.from('generated-assets').createSignedUrl(asset.file_path,300,{download:true});if(error){event.target.textContent=error.message;return;}const a=document.createElement('a');a.href=link.signedUrl;a.target='_blank';a.rel='noopener';a.click();};
}
