import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const renderer = 'https://varahqapp.vercel.app/api/template';
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function bytes(encoded:string) { return Uint8Array.from(atob(encoded), c => c.charCodeAt(0)); }
function check(result:any) { if(result.error) throw new Error(result.error.message); return result.data; }
async function organizationAccess(db:any,organizationId:string,userId:string) {
 const member=check(await db.from('organization_members').select('role').eq('organization_id',organizationId).eq('user_id',userId).maybeSingle());
 if(member) return {view:true,manageTemplates:['owner','admin'].includes(member.role)};
 const relationships=check(await db.from('organization_relationships').select('id').eq('client_organization_id',organizationId).eq('status','active')) || [];
 if(!relationships.length) return {view:false,manageTemplates:false};
 const grants=check(await db.from('organization_access_grants').select('can_view,can_manage_templates').eq('user_id',userId).in('relationship_id',relationships.map((relationship:any)=>relationship.id))) || [];
 return {view:grants.some((grant:any)=>grant.can_view),manageTemplates:grants.some((grant:any)=>grant.can_view&&grant.can_manage_templates)};
}
Deno.serve(async req => {
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 try {
  if(req.method!=='POST') return new Response('Method not allowed',{status:405,headers:cors});
  const authorization=req.headers.get('Authorization') || '';
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await db.auth.getUser(authorization.replace(/^Bearer /,''));
  if(error || !user) return Response.json({error:'Please sign in again.'},{status:401,headers:cors});
  const raw=await req.text(); if(raw.length>8*1024*1024) throw new Error('The request is too large.');
  const body=JSON.parse(raw); let org:string; let template:any;
  if(body.action==='font_upload') {
   if(!uuid.test(body.organization_id)) throw new Error('Choose an organization.'); org=body.organization_id;
  } else {
   if(!uuid.test(body.template_id)) throw new Error('Choose a template.');
   template=check(await db.from('templates').select('*').eq('id',body.template_id).single()); org=template.organization_id;
  }
  const access=await organizationAccess(db,org,user.id);
  if(!access.view) return Response.json({error:'Organization access required.'},{status:403,headers:cors});
  const admin=access.manageTemplates;
  if(['test','publish','unpublish','font_upload'].includes(body.action) && !admin) return Response.json({error:'Template management access required.'},{status:403,headers:cors});
  const callRenderer=async(payload:any)=>{
   const result=await fetch(renderer,{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(55000)});
   const text=await result.text(); let data:any;
   try { data=JSON.parse(text); } catch { throw new Error('The renderer is unavailable. Please try again shortly.'); }
   if(!result.ok) throw new Error(data.error || 'Template rendering failed.'); return data;
  };
  let output:any;
  if(body.action==='font_upload') {
   if(body.licensed!==true) throw new Error('Confirm you have permission to use and embed this font.');
   const font=bytes(body.font); if(font.length>5*1024*1024) throw new Error('Font files must be at most 5 MB.');
   const checked=await callRenderer({action:'font_check',organization_id:org,font:body.font});
   const id=crypto.randomUUID(),path=`${org}/${id}/font.bin`;
   check(await db.storage.from('brand-fonts').upload(path,font,{contentType:'application/octet-stream',upsert:false}));
   check(await db.from('organization_fonts').insert({id,organization_id:org,name:checked.name,file_path:path}));
   output={id,name:checked.name};
  } else if(body.action==='test') {
   const result=await callRenderer({action:'compile',template_id:template.id,revision:body.revision,values:body.values || {}});
   const path=`${org}/${template.id}/${crypto.randomUUID()}.json`;
   const bundle=JSON.stringify(result.bundle);
   if(bundle.length>25*1024*1024) throw new Error('This compiled template is too large. Use a smaller master PDF.');
   check(await db.storage.from('template-compiled').upload(path,bundle,{contentType:'application/json',upsert:false}));
   check(await db.rpc('record_template_test',{p_template_id:template.id,p_revision:result.revision,p_bundle_path:path,p_report:result.report}));
   output={revision:result.revision,status:'testing',report:result.report,preview:result.preview,pdf:result.pdf};
  } else if(body.action==='publish' || body.action==='unpublish') {
   check(await db.rpc('set_template_publication',{p_template_id:template.id,p_revision:body.revision,p_publish:body.action==='publish'}));
   output={status:body.action==='publish'?'published':'draft'};
  } else if(body.action==='generate') {
   if(template.status!=='published') throw new Error('Choose a published template.');
   const result=await callRenderer({action:'generate',template_id:template.id,values:body.values || {},format:body.format || 'pdf'});
   // Recheck publication after rendering so a simultaneous unpublish cannot release a new asset.
   const latest=check(await db.from('templates').select('status,revision').eq('id',template.id).single());
   if(latest.status!=='published' || latest.revision!==result.revision) throw new Error('This template changed. Reopen it before generating.');
   const id=crypto.randomUUID(),path=`${org}/${user.id}/${id}.${result.format}`;
   const mime={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg'}[result.format as 'pdf'|'png'|'jpg'];
   check(await db.storage.from('generated-assets').upload(path,bytes(result.file),{contentType:mime,upsert:false}));
   check(await db.from('generated_assets').insert({id,organization_id:org,template_id:template.id,user_id:user.id,file_path:path,output_format:result.format,input_values:result.values}));
   const link=check(await db.storage.from('generated-assets').createSignedUrl(path,300,{download:`${template.name.replace(/[^a-zA-Z0-9 -]/g,'')}.${result.format}`}));
   output={id,url:link.signedUrl,elapsed_ms:result.elapsed_ms,format:result.format};
  } else throw new Error('Unknown workflow action.');
  return Response.json(output,{headers:{...cors,'Cache-Control':'no-store'}});
 } catch(e) {
  console.error('template-workflow failed', e instanceof Error ? e.message : 'Unknown error');
  return Response.json({error:e instanceof Error?e.message:'The template action failed.'},{status:400,headers:cors});
 }
});
