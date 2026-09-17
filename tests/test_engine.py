import copy
import json
from pathlib import Path
import time
import unittest
import fitz
from renderer.engine import *

class EngineTests(unittest.TestCase):
    def setUp(self):
        self.fonts={name:path.read_bytes() for name,path in BUILTIN_FONTS.items()}
        doc=fitz.open();page=doc.new_page(width=252,height=144)
        page.draw_rect(page.rect,fill=(.91,.91,.88),color=None)
        page.draw_rect(fitz.Rect(190,80,240,130),fill=(.06,.18,.14),color=None)
        page.insert_font(fontname='OpenSans',fontbuffer=self.fonts['OpenSans-Regular'])
        page.insert_text((18,40),'{{FULL_NAME}}',fontname='OpenSans',fontsize=12,color=(.1,.2,.1))
        page.insert_text((18,70),'{{EMAIL}}',fontname='OpenSans',fontsize=9)
        self.master=doc.tobytes();self.fields=detect(self.master)['fields']
        for f in self.fields:
            f['width']=165;f['height']=22;f['min_font_size']=7;f['overflow_rule']='shrink'
            f['style_metadata']['font_id']='OpenSans-Regular'
    def test_five_profiles_and_artwork(self):
        bundle=compile_template(self.master,self.fields,self.fonts)
        start=time.perf_counter()
        for name in ['Cody Becker','Christopher Montgomery','Alexandria-Rose Richardson','Jordan Lee','Morgan Williams']:
            data,_=render(bundle,{'FULL_NAME':name,'EMAIL':'hello@example.com'})
            doc=fitz.open(stream=data,filetype='pdf')
            self.assertIn(name,doc[0].get_text());self.assertNotIn('{{',doc[0].get_text())
            original=fitz.open(stream=self.master,filetype='pdf')
            clip=fitz.Rect(190,80,240,130)
            self.assertEqual(doc[0].get_pixmap(clip=clip).samples,original[0].get_pixmap(clip=clip).samples)
        self.assertLess(time.perf_counter()-start,5)
    def test_overflow_rejected(self):
        bundle=compile_template(self.master,self.fields,self.fonts)
        with self.assertRaises(TemplateError): render(bundle,{'FULL_NAME':'W'*200,'EMAIL':'a@b.co'})
    def test_permissions(self):
        fields=copy.deepcopy(self.fields);fields[0]['user_editable']=False
        with self.assertRaises(TemplateError): resolve_values(fields,{'FULL_NAME':'Fake'}, {'full_name':'Real'})
        with self.assertRaises(TemplateError): resolve_values(fields,{'font_size':50}, {})
        values=resolve_values(fields,{'EMAIL':'a@b.co'},{'full_name':'Real'})
        self.assertEqual(values['FULL_NAME'],'Real')
    def test_missing_font_blocks_compilation(self):
        self.fields[0]['style_metadata']['font_id']='Missing'
        with self.assertRaisesRegex(TemplateError,'approved full font'):compile_template(self.master,self.fields,self.fonts)
    def test_required_and_invalid_geometry(self):
        with self.assertRaises(TemplateError):resolve_values(self.fields,{}, {})
        self.fields[0]['width']=10000
        with self.assertRaises(TemplateError):compile_template(self.master,self.fields,self.fonts)
    def test_image_outputs(self):
        bundle=compile_template(self.master,self.fields,self.fonts)
        for fmt,magic in [('png',b'\x89PNG'),('jpg',b'\xff\xd8')]:
            data,_=render(bundle,{'FULL_NAME':'Cody Becker','EMAIL':'a@b.co'},fmt);self.assertTrue(data.startswith(magic))
    def test_subset_and_glyphs(self):
        with self.assertRaises(TemplateError):validate_font(b'not a font')
        bundle=compile_template(self.master,self.fields,self.fonts)
        with self.assertRaises(TemplateError):render(bundle,{'FULL_NAME':'Name \U0001f600','EMAIL':'a@b.co'})
    def test_source_geometry_cannot_remove_artwork(self):
        self.fields[0]['style_metadata']['source_bbox']=[0,0,252,144]
        bundle=compile_template(self.master,self.fields,self.fonts)
        doc=fitz.open(stream=unb64(bundle['master']),filetype='pdf')
        original=fitz.open(stream=self.master,filetype='pdf')
        clip=fitz.Rect(190,80,240,130)
        self.assertEqual(doc[0].get_pixmap(clip=clip).samples,original[0].get_pixmap(clip=clip).samples)

if __name__=='__main__': unittest.main()
