"""Compile immutable PDF artwork once; render only approved text at generation."""
import base64
import hashlib
import io
import math
import re
from pathlib import Path
import fitz
from fontTools.ttLib import TTFont

FONT_DIR = Path(__file__).with_name('fonts')
BUILTIN_FONTS = {p.stem: p for p in FONT_DIR.glob('*.ttf')}
PLACEHOLDER = re.compile(r'\{\{\s*([A-Za-z][A-Za-z0-9_ ]{0,63})\s*\}\}?')
SOURCES = {'FULL_NAME':'user.full_name','TITLE':'user.title','EMAIL':'user.email','PHONE':'user.phone','PHONE_NUMBER':'user.phone','WEBSITE':'user.website','ADDRESS':'custom'}

class TemplateError(ValueError):
    pass

def b64(data):
    return base64.b64encode(data).decode()

def unb64(data):
    return base64.b64decode(data, validate=True)

def document(data):
    if len(data)>25*1024*1024 or not data.startswith(b'%PDF-'):
        raise TemplateError('Choose a PDF no larger than 25 MB.')
    doc=fitz.open(stream=data,filetype='pdf')
    if doc.needs_pass or not 1<=len(doc)<=10:
        raise TemplateError('Use an unlocked PDF with 1–10 pages.')
    for p in doc:
        if p.rotation or max(p.rect.width,p.rect.height)>2000:
            raise TemplateError('Rotated pages or pages larger than 2000 points are not supported yet.')
    return doc

def detect(data):
    doc=document(data)
    fields=[]; seen=set(); warnings=[]
    for page in doc:
        for block in page.get_text('dict',flags=0)['blocks']:
            for line in block.get('lines',[]):
                for span in line['spans']:
                    for match in PLACEHOLDER.finditer(span['text']):
                        if tuple(line['dir'])!=(1.0,0.0):
                            raise TemplateError('A variable is rotated. Use horizontal variable text.')
                        name=match.group(1).strip().upper().replace(' ','_')
                        rects=page.search_for(match.group(0))
                        rect=next((r for r in rects if r.intersects(fitz.Rect(span['bbox']))),None)
                        if rect is None: continue
                        key=(page.number,name,round(rect.x0,2),round(rect.y0,2))
                        if key in seen: continue
                        seen.add(key)
                        if match.group(0).endswith('}}') is False:
                            warnings.append(f'{name}: a closing brace is missing in the PDF; this field was still detected.')
                        font=span['font']; effect=span.get('alpha',255)!=255
                        if effect:
                            warnings.append(f'{name}: this PDF uses a patterned or transparent text effect. Preserve it in the master or explicitly choose a solid text color before testing.')
                        fields.append(dict(variable_name=name,label=name.replace('_',' ').title(),field_type='text',data_source=SOURCES.get(name,'custom'),page_number=page.number+1,x=rect.x0,y=rect.y0,width=rect.width,height=rect.height,font_family=font,font_weight='Regular',font_size=span['size'],min_font_size=span['size'],text_color=f"#{span['color']:06x}",alignment='left',overflow_rule='reject',max_lines=1,required=True,user_editable=True,style_metadata={'source_text':match.group(0),'source_bbox':list(rect),'source_origin':list(span['origin']),'source_font':font,'source_size':span['size'],'source_effect':effect,'effect_approved':False,'font_id':font if font in BUILTIN_FONTS else '', 'default_value':''}))
    if len(fields)>40: raise TemplateError('This PDF has more than 40 variable areas.')
    return {'fields':fields,'warnings':warnings,'pages':[{'width':p.rect.width,'height':p.rect.height} for p in doc]}

def preview(data, page=0):
    with fitz.open(stream=data,filetype='pdf') as doc:
        return b64(doc[page].get_pixmap(matrix=fitz.Matrix(min(3,1000/doc[page].rect.width),min(3,1000/doc[page].rect.width)),alpha=False).tobytes('png'))

def validate_font(data):
    try:
        font=TTFont(io.BytesIO(data))
        cmap=font.getBestCmap() or {}
        if not all(c in cmap for c in range(32,127)):
            raise TemplateError('This font is a subset. Upload the complete licensed font with letters, numbers, and punctuation.')
        if 'OS/2' in font and font['OS/2'].fsType & (2|512):
            raise TemplateError('This font restricts document embedding. Choose a font licensed for embedding.')
        name=next((n.toUnicode() for n in font['name'].names if n.nameID==6), 'Uploaded font')
        fitz.Font(fontbuffer=data)
        return name
    except TemplateError: raise
    except Exception as exc: raise TemplateError('The font could not be read. Upload a full TTF or OTF file.') from exc

def validate_fields(fields,pages):
    if not isinstance(fields,list) or not 1<=len(fields)<=40: raise TemplateError('Detect or add at least one variable field.')
    seen=set()
    for f in fields:
        if not re.fullmatch(r'[A-Z][A-Z0-9_]{0,63}',f.get('variable_name','')): raise TemplateError('Variable names must use letters, numbers, and underscores.')
        key=(f['variable_name'],f.get('page_number'),f.get('x'),f.get('y'))
        if key in seen: raise TemplateError('Remove duplicate variable areas.')
        seen.add(key)
        if f.get('field_type','text')!='text': raise TemplateError('Only text variables can be published in this version.')
        if f.get('data_source') not in set(SOURCES.values()): raise TemplateError('Choose a supported data source.')
        if f.get('alignment') not in ('left','center','right') or f.get('overflow_rule') not in ('reject','shrink','wrap'): raise TemplateError('Choose a valid alignment and fitting rule.')
        for k in ('x','y','width','height','font_size','min_font_size'):
            if isinstance(f.get(k),bool) or not isinstance(f.get(k),(int,float)) or not math.isfinite(f[k]): raise TemplateError(f'Invalid {k}.')
        if not isinstance(f.get('page_number'),int) or not 1<=f['page_number']<=len(pages): raise TemplateError('Invalid page number.')
        p=pages[f['page_number']-1]
        if min(f['x'],f['y'])<0 or min(f['width'],f['height'])<=0 or f['x']+f['width']>p['width']+.01 or f['y']+f['height']>p['height']+.01: raise TemplateError(f"{f['label']}: the field must stay within the page.")
        if not 3<=f['min_font_size']<=f['font_size']<=200: raise TemplateError('Font sizes must be between 3 and 200 points, with minimum at or below the original size.')
        if type(f.get('max_lines')) is not int or not 1<=f['max_lines']<=10: raise TemplateError('Maximum lines must be between 1 and 10.')
        if not re.fullmatch('#[0-9a-fA-F]{6}',f.get('text_color','')): raise TemplateError('Choose a valid text color.')
        if not isinstance(f.get('required'),bool) or not isinstance(f.get('user_editable'),bool): raise TemplateError('Invalid field permissions.')
        if not isinstance(f.get('label'),str) or not 1<=len(f['label'])<=120: raise TemplateError('Use a field label between 1 and 120 characters.')
        if not isinstance(f.get('style_metadata'),dict): raise TemplateError('Invalid field configuration.')
        if len(str(f['style_metadata'].get('default_value','')))>1000: raise TemplateError('Default values must be 1000 characters or fewer.')

def compile_template(master,fields,font_data):
    detected=detect(master); validate_fields(fields,detected['pages'])
    # Source removal geometry is resolved from the PDF, never from submitted metadata.
    doc=document(master); matched=set(); compiled=[]; fonts={}
    for f in fields:
        f={**f,'style_metadata':dict(f['style_metadata'])}
        meta=f['style_metadata']; source=None
        for i,d in enumerate(detected['fields']):
            if i not in matched and d['variable_name']==f['variable_name'] and d['page_number']==f['page_number']:
                source=d; matched.add(i); break
        if source:
            original=source['style_metadata']
            if original['source_effect'] and not meta.get('effect_approved'):
                raise TemplateError(f"{f['label']}: the original uses a text effect. Choose an approved solid color and confirm the change, or upload a master with plain variable text.")
            rect=fitz.Rect(original['source_bbox'])
            # Only placeholder text is removed; images and vector artwork remain intact.
            doc[f['page_number']-1].add_redact_annot(rect,fill=False,cross_out=False)
            meta['baseline_ratio']=(original['source_origin'][1]-original['source_bbox'][1])/original['source_size']
        else:
            if not meta.get('manual'): raise TemplateError(f"{f['label']}: the original placeholder was not found. Detect fields again.")
            meta['baseline_ratio']=1.0
        font_id=meta.get('font_id','')
        data=font_data.get(font_id)
        if not data: raise TemplateError(f"{f['label']}: select an approved full font. The PDF’s embedded subset cannot generate new text.")
        validate_font(data); fonts[font_id]=b64(data)
        compiled.append(f)
    if len(matched)!=len(detected['fields']): raise TemplateError('Every detected placeholder must be configured before publishing.')
    for page in doc:
        page.apply_redactions(images=0,graphics=0,text=0)
    clean=doc.tobytes(deflate=True,garbage=4)
    # No placeholder should survive (including duplicated pattern text).
    with fitz.open(stream=clean,filetype='pdf') as check:
        if any(PLACEHOLDER.search(p.get_text()) for p in check): raise TemplateError('A placeholder could not be removed safely. Use plain text placeholders in the master.')
    return {'schema':1,'master_sha256':hashlib.sha256(master).hexdigest(),'master':b64(clean),'fields':compiled,'fonts':fonts,'pages':detected['pages']}

def resolve_values(fields,submitted,profile,admin_test=False):
    if not isinstance(submitted,dict) or len(submitted)>40: raise TemplateError('Enter valid field values.')
    allowed={f['variable_name'] for f in fields if f['user_editable'] or admin_test}
    if set(submitted)-allowed: raise TemplateError('This request changes a protected or unknown field.')
    result={}
    for f in fields:
        key=f['variable_name']; source=f['data_source']; default=f['style_metadata'].get('default_value','')
        value=profile.get(source[5:]) if source.startswith('user.') else default
        if value is None: value=default
        if key in submitted and (f['user_editable'] or admin_test): value=submitted[key]
        if not isinstance(value,str) or len(value)>1000 or any(ord(c)<32 and c!='\n' for c in value): raise TemplateError(f"{f['label']}: enter text of 1000 characters or fewer.")
        if f['required'] and not value.strip(): raise TemplateError(f"{f['label']} is required.")
        result[key]=value.strip()
    return result

def layout(f,text,font):
    for char in text:
        if char!='\n' and not font.has_glyph(ord(char),fallback=False): raise TemplateError(f"{f['label']}: the approved font does not include {char!r}.")
    size=f['font_size']; minimum=f['min_font_size']; rule=f['overflow_rule']
    while True:
        lines=text.split('\n')
        if rule=='wrap':
            wrapped=[]
            for line in lines:
                current=''
                for word in line.split(' '):
                    candidate=(current+' '+word).strip()
                    if current and font.text_length(candidate,fontsize=size)>f['width']: wrapped.append(current); current=word
                    else: current=candidate
                wrapped.append(current)
            lines=wrapped
        ratio=f['style_metadata']['baseline_ratio']; step=size*1.25
        fits=(len(lines)<=f['max_lines'] and (len(lines)-1)*step+size*(ratio+max(0,-font.descender))<=f['height']+.15 and all(font.text_length(line,fontsize=size)<=f['width']+.01 for line in lines))
        if fits: return size,lines
        if rule!='shrink' or size<=minimum+.001: raise TemplateError(f"{f['label']} is too long for this design. Shorten it or ask an administrator to adjust its approved bounds.")
        size=max(minimum,round(size-.1,4))

def render(bundle,values,output='pdf'):
    if bundle.get('schema')!=1: raise TemplateError('Re-test and publish this template with the current renderer.')
    if output not in ('pdf','png','jpg'): raise TemplateError('Choose PDF, PNG, or JPG.')
    doc=fitz.open(stream=unb64(bundle['master']),filetype='pdf'); fitted=[]
    for i,f in enumerate(bundle['fields']):
        text=values.get(f['variable_name'],''); data=unb64(bundle['fonts'][f['style_metadata']['font_id']]); font=fitz.Font(fontbuffer=data)
        size,lines=layout(f,text,font); page=doc[f['page_number']-1]; alias=f'Vara{i}'
        page.insert_font(fontname=alias,fontbuffer=data)
        color=tuple(int(f['text_color'][j:j+2],16)/255 for j in (1,3,5))
        for n,line in enumerate(lines):
            length=font.text_length(line,fontsize=size)
            x=f['x']+({'left':0,'center':.5,'right':1}[f['alignment']])*(f['width']-length)
            y=f['y']+size*f['style_metadata']['baseline_ratio']+n*size*1.25
            page.insert_text((x,y),line,fontsize=size,fontname=alias,color=color,overlay=True)
        fitted.append({'field':f['variable_name'],'font_size':size,'lines':len(lines)})
    pdf=doc.tobytes(deflate=True,garbage=4)
    if output=='pdf': return pdf,fitted
    if len(doc)!=1: raise TemplateError('Use PDF for a multi-page template. PNG and JPG currently support one page.')
    page=doc[0]
    if page.rect.width*page.rect.height*(300/72)**2>20000000: raise TemplateError('This design is too large for a 300 DPI image. Choose PDF.')
    pix=page.get_pixmap(dpi=300,alpha=False)
    return pix.tobytes('png' if output=='png' else 'jpeg',jpg_quality=95),fitted
