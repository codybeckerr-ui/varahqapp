"""Authenticated Python compiler/renderer. No service-role credential is used here."""
import base64
import json
import logging
import time
import uuid
from urllib.parse import quote
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from renderer.engine import (BUILTIN_FONTS,TemplateError,compile_template,detect,document,preview,render,resolve_values,validate_fields,b64,unb64,validate_font)

URL='https://wzgfzopxltgfkejpofat.supabase.co'
KEY='sb_publishable_R4UOrzo-lb95ExANWotdPw_2VSADYzc'
app=FastAPI(docs_url=None,redoc_url=None,openapi_url=None)
app.add_middleware(CORSMiddleware,allow_origins=['https://varahqapp.vercel.app','http://127.0.0.1:4173','http://localhost:4173','null'],allow_methods=['POST','GET'],allow_headers=['Authorization','Content-Type'])

class Backend:
    def __init__(self,authorization):
        if not authorization.startswith('Bearer '): raise PermissionError('Please sign in again.')
        self.client=httpx.Client(base_url=URL,headers={'apikey':KEY,'Authorization':authorization},timeout=25)
    def request(self,method,path,**kwargs):
        r=self.client.request(method,path,**kwargs)
        if r.status_code>=400:
            if r.status_code in (401,403): raise PermissionError('You do not have access to this template. Sign in with the correct organization account.')
            try: msg=r.json().get('message','The saved template could not be loaded.')
            except Exception: msg='The template service could not complete the request.'
            raise TemplateError(msg)
        return r
    def rows(self,table,**filters):
        return self.request('GET','/rest/v1/'+table,params=filters).json()
    def file(self,bucket,path):
        r=self.request('GET','/storage/v1/object/authenticated/'+bucket+'/'+quote(path,safe='/'))
        if len(r.content)>25*1024*1024: raise TemplateError('File is too large.')
        return r.content

@app.get('/api/template')
def health(): return {'service':'VaraHQ template renderer','version':1}

@app.post('/api/template')
async def endpoint(request:Request):
    started=time.perf_counter(); db=None
    try:
        raw=await request.body()
        if len(raw)>8*1024*1024: raise TemplateError('The request is too large.')
        body=json.loads(raw)
        if not isinstance(body,dict): raise TemplateError('Invalid request.')
        db=Backend(request.headers.get('authorization',''))
        user=db.request('GET','/auth/v1/user').json()
        action=body.get('action')
        if action=='font_check':
            data=unb64(body.get('font',''))
            if len(data)>5*1024*1024: raise TemplateError('Font files must be at most 5 MB.')
            memberships=db.rows('organization_members',organization_id='eq.'+str(uuid.UUID(body['organization_id'])),user_id='eq.'+user['id'])
            if not memberships or memberships[0]['role'] not in ('owner','admin'): raise PermissionError('Administrator access required.')
            return {'name':validate_font(data)}
        template_id=str(uuid.UUID(body['template_id']))
        rows=db.rows('templates',id='eq.'+template_id)
        if not rows: raise PermissionError('Template not found or access denied.')
        template=rows[0]
        memberships=db.rows('organization_members',organization_id='eq.'+template['organization_id'],user_id='eq.'+user['id'])
        if not memberships: raise PermissionError('Organization access required.')
        admin=memberships[0]['role'] in ('owner','admin')
        profiles=db.rows('profiles',id='eq.'+user['id']); profile=profiles[0] if profiles else {}
        if action in ('inspect','detect','save','compile') and not admin: raise PermissionError('Only an owner or admin can configure templates.')
        fields=db.rows('template_fields',template_id='eq.'+template_id,order='page_number,y,x')
        if action in ('inspect','detect','save','compile'):
            expected=template['organization_id']+'/'+template_id+'/master.pdf'
            if template['master_file_path']!=expected: raise TemplateError('The master path does not match this template.')
            master=db.file('template-masters',expected)
            fonts=db.rows('organization_fonts',organization_id='eq.'+template['organization_id'])
        if action in ('inspect','detect'):
            detected=detect(master)
            saved_test={}
            if action=='inspect' and template['status'] in ('testing','published'):
                records=db.rows('template_compilations',template_id='eq.'+template_id,revision='eq.'+str(template['revision']))
                if records:
                    compiled=json.loads(db.file('template-compiled',records[0]['bundle_path']))
                    tested,_=render(compiled,records[0]['report']['tested_values'])
                    saved_test={'report':records[0]['report'],'testPreview':preview(tested)}
            return {**saved_test,'template':template,'fields':fields if fields and action=='inspect' else detected['fields'],'warnings':detected['warnings'],'pages':detected['pages'],'preview':preview(master),'fonts':[{'id':name,'name':name} for name in BUILTIN_FONTS]+[{'id':f['id'],'name':f['name']} for f in fonts], 'profile':{k:profile.get(k,'') for k in ('full_name','email','title','phone','website')}}
        if action=='save':
            incoming=body.get('fields'); validate_fields(incoming,detect(master)['pages'])
            revision=db.request('POST','/rest/v1/rpc/save_template_fields',json={'p_template_id':template_id,'p_revision':body.get('revision'),'p_fields':incoming}).json()
            return {'revision':revision,'status':'draft'}
        if action=='compile':
            if template['status'] not in ('draft','testing'): raise TemplateError('Return this template to draft before testing changes.')
            if body.get('revision')!=template['revision']: raise TemplateError('The template changed. Reopen it and test the latest saved version.')
            font_data={name:path.read_bytes() for name,path in BUILTIN_FONTS.items()}
            for f in fields:
                fid=f['style_metadata'].get('font_id')
                if fid in font_data: continue
                found=next((font for font in fonts if font['id']==fid),None)
                if found: font_data[fid]=db.file('brand-fonts',found['file_path'])
            bundle=compile_template(master,fields,font_data)
            values=resolve_values(bundle['fields'],body.get('values',{}),profile,admin_test=True)
            pdf,fitted=render(bundle,values)
            stress=[]
            for name in ('Cody Becker','Christopher Montgomery','Alexandria-Rose Richardson','Jordan Lee','Morgan Williams'):
                trial=dict(values)
                for f in bundle['fields']:
                    if f['data_source']=='user.full_name': trial[f['variable_name']]=name
                try:
                    _,fit=render(bundle,trial); stress.append({'name':name,'result':'fits','fit':fit})
                except TemplateError as e: stress.append({'name':name,'result':'rejected','message':str(e)})
            report={'fit':fitted,'stress':stress,'tested_values':values,'elapsed_ms':round((time.perf_counter()-started)*1000)}
            if len(json.dumps(bundle))>3*1024*1024: raise TemplateError('This template is too large to compile in one request. Use a smaller PDF or fewer full fonts.')
            return {'bundle':bundle,'revision':template['revision'],'report':report,'preview':preview(pdf),'pdf':b64(pdf)}
        if action in ('personalize','generate'):
            if template['status']!='published': raise TemplateError('This template is not published yet.')
            records=db.rows('template_compilations',template_id='eq.'+template_id,revision='eq.'+str(template['revision']))
            if not records: raise TemplateError('The published template needs to be tested again.')
            bundle=json.loads(db.file('template-compiled',records[0]['bundle_path']))
            if action=='personalize':
                values={}
                for f in bundle['fields']:
                    source=f['data_source']; value=(profile.get(source[5:]) if source.startswith('user.') else None) or f['style_metadata'].get('default_value','')
                    values[f['variable_name']]=value
                return {'template':{'id':template_id,'name':template['name']},'fields':[{'variable_name':f['variable_name'],'label':f['label'],'required':f['required'],'user_editable':f['user_editable']} for f in bundle['fields']], 'values':values,'preview':preview(unb64(bundle['master']))}
            values=resolve_values(bundle['fields'],body.get('values',{}),profile)
            output=body.get('format','pdf'); result,fit=render(bundle,values,output)
            return {'file':b64(result),'format':output,'values':values,'fit':fit,'elapsed_ms':round((time.perf_counter()-started)*1000),'revision':template['revision']}
        raise TemplateError('Unknown template action.')
    except PermissionError as exc: return JSONResponse({'error':str(exc)},status_code=403)
    except (TemplateError,ValueError,KeyError,TypeError) as exc: return JSONResponse({'error':str(exc) if isinstance(exc,TemplateError) else 'Invalid template request.'},status_code=422)
    except Exception:
        logging.exception('Template action failed')
        return JSONResponse({'error':'The renderer could not complete this request. Please try again.'},status_code=500)
    finally:
        if db: db.client.close()
