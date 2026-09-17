import os
import unittest
from unittest.mock import Mock, patch

from renderer import google_fonts
from renderer.engine import BUILTIN_FONTS, TemplateError


class GoogleFontsTests(unittest.TestCase):
    def setUp(self):
        google_fonts._catalog_cache = None
        google_fonts._catalog_expires = 0
        google_fonts._font_cache.clear()

    def test_api_key_stays_server_side_and_catalog_is_normalized(self):
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {'items': [{'family':'Roboto','variants':['regular','700'],'files':{'regular':'http://fonts.gstatic.com/roboto.ttf','700':'https://fonts.gstatic.com/roboto-bold.ttf'},'category':'sans-serif'}]}
        with patch.dict(os.environ, {'GOOGLE_FONTS_API_KEY':'secret-key'}), patch('renderer.google_fonts.httpx.get', return_value=response) as request:
            fonts = google_fonts.list_fonts('rob', 10)
        self.assertEqual([font['id'] for font in fonts], ['google:Roboto:regular','google:Roboto:700'])
        self.assertEqual(request.call_args.kwargs['params']['key'], 'secret-key')

    def test_missing_key_has_clear_error(self):
        with patch.dict(os.environ, {}, clear=True), self.assertRaisesRegex(TemplateError, 'not configured'):
            google_fonts.list_fonts()

    def test_download_only_uses_google_host_and_validates_font(self):
        google_fonts._catalog_cache = [{'family':'Roboto','variants':['regular'],'files':{'regular':'http://fonts.gstatic.com/roboto.ttf'}}]
        google_fonts._catalog_expires = float('inf')
        response = Mock(content=BUILTIN_FONTS['OpenSans-Regular'].read_bytes())
        response.raise_for_status.return_value = None
        with patch('renderer.google_fonts.httpx.get', return_value=response) as request:
            data = google_fonts.download_font('google:Roboto:regular')
        self.assertGreater(len(data), 1000)
        self.assertEqual(request.call_args.args[0], 'https://fonts.gstatic.com/roboto.ttf')

    def test_rejects_non_google_download_host(self):
        google_fonts._catalog_cache = [{'family':'Roboto','variants':['regular'],'files':{'regular':'https://example.com/roboto.ttf'}}]
        google_fonts._catalog_expires = float('inf')
        with self.assertRaisesRegex(TemplateError, 'unsafe'):
            google_fonts.download_font('google:Roboto:regular')

    def test_exact_pdf_font_name_matches_family_and_style(self):
        google_fonts._catalog_cache = [{'family':'Montserrat','variants':['regular','600','700italic'],'files':{'regular':'x','600':'x','700italic':'x'}}]
        google_fonts._catalog_expires = float('inf')
        self.assertEqual(google_fonts.match_source_font('ABCDEF+Montserrat-SemiBold')['id'], 'google:Montserrat:600')
        self.assertEqual(google_fonts.match_source_font('Montserrat-BoldItalic')['id'], 'google:Montserrat:700italic')

    def test_unknown_pdf_font_is_not_substituted(self):
        google_fonts._catalog_cache = [{'family':'Montserrat','variants':['regular'],'files':{'regular':'x'}}]
        google_fonts._catalog_expires = float('inf')
        self.assertIsNone(google_fonts.match_source_font('Gotham-Book'))


if __name__ == '__main__':
    unittest.main()
