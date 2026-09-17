# VaraHQ — Brand Assets. Simplified.

The existing homepage, signup and organization workspace are preserved. Application source lives in this active `varahqapp` checkout.

## Template workflow

1. Upload a Canva PDF in Templates; the original is private and immutable once referenced.
2. Open **Configure & Publish**. Detected text placeholders become configurable fields. A missing closing brace is reported and can still be detected.
3. Choose approved full fonts, bounds, fitting rules, data sources, required fields and member editing permissions. Drag a box to move it or its corner to resize. Upload licensed TTF/OTF files when a required font is unavailable.
4. **Save & Test Template** runs the Python compiler and renders a personalized preview. Five name stress tests report content that fits or is safely rejected.
5. **Publish Template** becomes available only after a successful test of the current saved revision.
6. Members select **Personalize**, preview their approved content and generate PDF, PNG or JPG. Saved files appear in Downloads.

The master must contain selectable horizontal text placeholders, such as `{{FULL_NAME}}`. This version supports text variables, up to ten unrotated pages and 40 fields. PNG/JPG exports and the visual canvas currently show one page; use PDF for multi-page outputs. Pattern/gradient text requires an explicit administrator-approved solid color or a revised master. Missing full fonts block testing; embedded font subsets are never used as a fallback. Open Sans full fonts are bundled under their included OFL license. Nourd is not bundled.

## Server boundaries

- `api/template.py`: Vercel Python/FastAPI API. Validates the Supabase user token; reads tenant-scoped source and configuration with that token. It has no service-role key. Uses `renderer/engine.py` for detection, compilation, fitting and PDF/image rendering.
- Organization access is presented as two levels: Admins (`owner` and `admin` database roles) manage draft templates and publication; Users (`manager` and `member` roles) can only see, personalize, generate, and download published templates. Database RLS and server checks enforce these boundaries independently of the interface.
- `supabase/functions/template-workflow/index.ts`: authenticated gateway. Verifies the user and database membership; calls the fixed renderer URL; persists successful compilations, publishing state and generated outputs using its server-only credential.
- Publishing is restricted to server RPCs. Field mutations increment the revision and invalidate test eligibility. Published fields cannot be modified until returned to Draft.
- Member generation accepts only template identity, output format and allowed values. Profile values and design rules are resolved on the server.
- Compiled artifacts and downloaded assets use private storage and RLS. Download links expire after five minutes.

## Development and verification

Python 3.12, dependencies in `requirements.txt` / `requirements-lock.txt`.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m unittest discover -s tests -v
```

The Vercel project uses its existing static pages plus `/api/template`. Deploy with local Git to `main`; deploy Supabase migrations and the tracked Edge Function separately. The gateway renderer URL is fixed to `https://varahqapp.vercel.app/api/template`.

For browser QA, use the signed-in workspace. A local `file:` page can call the hosted renderer using its bearer token, but the hosted app is the normal entry point. No passwords or service keys belong in this repository.

Renderer tests cover five names, unchanged artwork outside variable areas, missing full fonts, unsupported glyphs, overflow, required fields, geometry, protected values and PDF/PNG/JPG output. Local render timings exclude network/auth/storage and do not represent deployed end-to-end latency.
