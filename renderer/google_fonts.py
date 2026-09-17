"""Server-only Google Fonts catalog and exact font-file resolver."""
import os
import re
import time
from urllib.parse import urlparse

import httpx

from renderer.engine import TemplateError, validate_font

API_URL = 'https://www.googleapis.com/webfonts/v1/webfonts'
MAX_FONT_BYTES = 5 * 1024 * 1024
_catalog_cache = None
_catalog_expires = 0
_font_cache = {}


def _api_key():
    key = os.getenv('GOOGLE_FONTS_API_KEY', '').strip()
    if not key:
        raise TemplateError('Google Fonts is not configured yet. Add the server-side Google Fonts API key.')
    return key


def _catalog():
    global _catalog_cache, _catalog_expires
    now = time.time()
    if _catalog_cache is not None and now < _catalog_expires:
        return _catalog_cache
    try:
        response = httpx.get(API_URL, params={'key': _api_key(), 'sort': 'popularity'}, timeout=15)
        response.raise_for_status()
        items = response.json().get('items', [])
    except TemplateError:
        raise
    except Exception as exc:
        raise TemplateError('Google Fonts could not be reached. Try again shortly.') from exc
    if not isinstance(items, list):
        raise TemplateError('Google Fonts returned an invalid catalog.')
    _catalog_cache = items
    _catalog_expires = now + 6 * 60 * 60
    return items


def font_id(family, variant):
    return f'google:{family}:{variant}'


def _normalized(value):
    value = re.sub(r'^[A-Z]{6}\+', '', str(value or ''))
    return re.sub(r'[^a-z0-9]', '', value.casefold())


def _variant_names(family, variant):
    weights = {
        '100':'Thin', '200':'ExtraLight', '300':'Light', '400':'Regular',
        '500':'Medium', '600':'SemiBold', '700':'Bold', '800':'ExtraBold', '900':'Black',
    }
    italic = variant.endswith('italic')
    weight = variant[:-6] if italic else variant
    if weight == 'regular':
        weight = '400'
    label = weights.get(weight, weight)
    suffixes = [label + ('Italic' if italic else '')]
    if weight == '400':
        suffixes.extend(['Italic'] if italic else ['', 'Regular'])
    if weight == '700':
        suffixes.append('BoldItalic' if italic else 'Bold')
    return {_normalized(family + suffix) for suffix in suffixes}


def match_source_font(source_name):
    """Return a Google font only for an exact family/style PostScript-name match."""
    source = _normalized(source_name)
    if not source:
        return None
    matches = []
    for family in _catalog():
        name = family.get('family', '')
        for variant in family.get('variants', []):
            if variant in family.get('files', {}) and source in _variant_names(name, variant):
                matches.append({'id':font_id(name, variant),'family':name,'variant':variant})
    return matches[0] if len(matches) == 1 else None


def _split_id(value):
    if not isinstance(value, str) or not value.startswith('google:'):
        raise TemplateError('Choose a valid Google Font.')
    try:
        family, variant = value[7:].rsplit(':', 1)
    except ValueError as exc:
        raise TemplateError('Choose a valid Google Font.') from exc
    if not family or not variant or len(value) > 240:
        raise TemplateError('Choose a valid Google Font.')
    return family, variant


def list_fonts(query='', limit=80, selected_ids=()):
    query = str(query or '').strip().casefold()[:80]
    limit = max(1, min(int(limit), 120))
    selected = set(selected_ids or ())
    results = []
    selected_results = []
    for family in _catalog():
        name = family.get('family', '')
        if not isinstance(name, str) or (query and query not in name.casefold()):
            continue
        files = family.get('files', {})
        if not isinstance(files, dict):
            continue
        for variant in family.get('variants', []):
            if variant not in files:
                continue
            identifier = font_id(name, variant)
            item = {
                'id': identifier,
                'name': f'{name} · {variant.replace("regular", "Regular").replace("italic", " Italic").strip()}',
                'family': name,
                'variant': variant,
                'category': family.get('category', ''),
                'source': 'google',
            }
            if identifier in selected:
                selected_results.append(item)
            elif len(results) < limit:
                results.append(item)
    known = {item['id'] for item in results}
    return results + [item for item in selected_results if item['id'] not in known]


def download_font(identifier):
    if identifier in _font_cache:
        return _font_cache[identifier]
    family_name, variant = _split_id(identifier)
    family = next((item for item in _catalog() if item.get('family') == family_name), None)
    url = family.get('files', {}).get(variant) if family else None
    if not isinstance(url, str):
        raise TemplateError('That Google Font style is no longer available. Choose another style.')
    parsed = urlparse(url.replace('http://', 'https://', 1))
    if parsed.scheme != 'https' or parsed.hostname != 'fonts.gstatic.com':
        raise TemplateError('Google Fonts returned an unsafe font location.')
    try:
        response = httpx.get(parsed.geturl(), timeout=20, follow_redirects=False)
        response.raise_for_status()
        data = response.content
    except Exception as exc:
        raise TemplateError('The selected Google Font could not be downloaded. Try again shortly.') from exc
    if len(data) > MAX_FONT_BYTES:
        raise TemplateError('The selected Google Font is too large to embed.')
    validate_font(data)
    _font_cache[identifier] = data
    return data
