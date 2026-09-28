"""End-to-end: sell wizard login paths, drafts, My listings tabs, mobile navbar avatar.
Runs against the local site (:3012) wired to the in-memory PostgREST stand-in (:54329)."""
import asyncio, base64, json, os, urllib.request
from playwright.async_api import async_playwright, expect

OUT = os.path.dirname(os.path.abspath(__file__))
BASE = 'http://localhost:3012'
DB = 'http://localhost:54329/rest/v1'
EMAIL, PW = 'ana.test@example.com', 'Secreto123!'
UID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')

results = []
def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''), flush=True)

def db(path):
    with urllib.request.urlopen(f'{DB}/{path}') as r:
        return json.loads(r.read())

async def pick_address(page, text='Avenida Mariscal López 1234, Asunción'):
    inp = page.get_by_placeholder('Escribí la dirección…')
    await inp.click()
    await inp.type(text, delay=40)
    item = page.locator('.pac-item').first
    await item.wait_for(timeout=20000)
    await item.click()
    await page.get_by_text('Barrio:').wait_for(timeout=10000)

async def wizard_to_have_account(page):
    dlg = page.get_by_role('dialog')
    await dlg.get_by_role('button', name='Vender', exact=True).click()
    await dlg.get_by_role('button', name='Propietario').click()
    await page.get_by_placeholder('Ana Giménez').fill('Ana Test')
    await page.get_by_placeholder('ana@correo.com').fill(EMAIL)
    await dlg.get_by_role('button', name='Siguiente').click()
    await pick_address(page)
    await dlg.get_by_role('button', name='Siguiente').click()
    await page.get_by_text('Ya tenés una cuenta').wait_for(timeout=15000)

async def open_wizard(page):
    await page.goto(f'{BASE}/', wait_until='load', timeout=180000)
    await page.wait_for_timeout(2500)
    await page.get_by_role('button', name='Publicar gratis').first.click()
    await page.get_by_text('¿Qué querés hacer?').wait_for(timeout=10000)

async def me(page):
    r = await page.request.get(f'{BASE}/api/auth/me')
    return (await r.json()).get('user')

async def password_and_drafts(b):
    ctx = await b.new_context(viewport={'width': 1300, 'height': 900}, locale='es-PY')
    page = await ctx.new_page()
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    await open_wizard(page)
    await wizard_to_have_account(page)
    check('A1 existing email → "Ya tenés una cuenta" with Google + password', await page.get_by_role('button', name='Continuar con Google').count() == 1 and await page.get_by_placeholder('••••••••').count() == 1)
    await page.get_by_placeholder('••••••••').fill(PW)
    await page.get_by_role('dialog').get_by_role('button', name='Ingresar', exact=True).click()
    await page.get_by_text('Últimos detalles').wait_for(timeout=15000)
    check('A2 password login → wizard stays open at the details step', True)
    u = await me(page)
    check('A3 user is logged in after password', u and u.get('email') == EMAIL)

    # draft created once the address is known + user signed in
    await page.wait_for_timeout(1500)
    drafts = db(f'listing_drafts?user_id=eq.{UID}')
    check('A4 draft created with the address', len(drafts) == 1 and drafts[0]['data'].get('neighborhood'), json.dumps(drafts[0]['data'] if drafts else {}, ensure_ascii=False)[:160])
    await page.get_by_placeholder('145.000').fill('150000')
    await page.get_by_placeholder('120', exact=True).fill('120')
    await page.get_by_placeholder('0981 123 456').fill('0981 555 444')
    await page.wait_for_timeout(1800)
    d = db(f'listing_drafts?user_id=eq.{UID}')[0]['data']
    check('A5 draft autosaves the details', d.get('price') == '150000' and d.get('area') == '120' and d.get('contact_phone') == '0981 555 444', json.dumps(d, ensure_ascii=False)[:200])

    # leave without publishing
    await page.get_by_role('dialog').get_by_role('button', name='Cerrar').first.click()
    await page.goto(f'{BASE}/cuenta/publicaciones', wait_until='load')
    await page.get_by_role('tab', name='Borradores').wait_for(timeout=15000)
    await page.wait_for_timeout(1500)
    tabs_txt = await page.get_by_role('tablist').inner_text()
    check('A6 My listings shows tabs Publicadas / Borradores with counts', 'Publicadas' in tabs_txt and 'Borradores' in tabs_txt, tabs_txt.replace('\n', ' '))
    await page.get_by_role('tab', name='Borradores').click()
    card = page.get_by_test_id('draft-card')
    await card.first.wait_for(timeout=10000)
    ctext = await card.first.inner_text()
    check('A7 draft card shows place + what is missing (photos)', 'Falta: fotos' in ctext, ctext.replace('\n', ' | ')[:200])
    await page.screenshot(path=os.path.join(OUT, 'e2e_drafts_tab.png'))

    # continue → wizard at details with saved values → publish
    await card.first.get_by_role('button', name='Continuar').click()
    await page.get_by_text('Últimos detalles').wait_for(timeout=10000)
    price_val = await page.get_by_placeholder('145.000').input_value()
    check('A8 "Continuar" reopens the wizard at details, prefilled', price_val == '150000', price_val)
    await page.locator('input[type=file]').set_input_files({'name': 'foto.png', 'mimeType': 'image/png', 'buffer': PNG})
    await page.get_by_role('dialog').get_by_role('button', name='Publicar gratis').click()
    await page.get_by_text('¡Tu propiedad está publicada!').wait_for(timeout=60000)
    check('A9 publishing from the draft succeeds', True)
    left = db(f'listing_drafts?user_id=eq.{UID}')
    mine = db(f'properties?created_by=eq.{UID}&select=id,neighborhood,price')
    check('A10 draft deleted after publish; listing belongs to the user', len(left) == 0 and len(mine) == 1, f'drafts={len(left)} props={mine}')
    await page.get_by_role('dialog').get_by_role('button', name='Cerrar').first.click()
    await page.wait_for_timeout(1500)
    tabs_txt = await page.get_by_role('tablist').inner_text()
    check('A11 tabs refresh in place: Publicadas 1, Borradores 0', 'Publicadas\n1' in tabs_txt and 'Borradores\n0' in tabs_txt, tabs_txt.replace('\n', ' '))
    check('A12 no page errors', not errs, '; '.join(errs)[:200])
    await ctx.close()

async def google_resume(b):
    """Google path: the wizard stashes the form, goes to Google, comes back signed in
    to <same page>?sell=resume and reopens at details. Google itself is simulated:
    /api/auth/google is intercepted and the session is set like the callback would."""
    ctx = await b.new_context(viewport={'width': 1300, 'height': 900}, locale='es-PY')
    page = await ctx.new_page()
    sent = {}
    async def fake_google(route):
        sent.update(json.loads(route.request.post_data or '{}'))
        # what the real callback does on success: set the session, redirect to state
        await page.request.post(f'{BASE}/api/auth/login', data={'email': EMAIL, 'password': PW})
        await route.fulfill(status=200, content_type='application/json', body=json.dumps({'url': sent.get('next', '/')}))
    await page.route('**/api/auth/google', fake_google)
    await open_wizard(page)
    await wizard_to_have_account(page)
    check('B0 not logged in before Google', (await me(page)) is None)
    await page.get_by_role('button', name='Continuar con Google').click()
    await page.get_by_text('Últimos detalles').wait_for(timeout=20000)
    check('B1 wizard asks Google to return to the same page with ?sell=resume', sent.get('next') == '/?sell=resume', str(sent))
    check('B2 after Google, the wizard reopens at the details step', True)
    u = await me(page)
    check('B3 user is logged in after Google', u and u.get('email') == EMAIL)
    check('B4 resume marker removed from the URL', 'sell=resume' not in page.url, page.url)
    await page.wait_for_timeout(1500)
    drafts = db(f'listing_drafts?user_id=eq.{UID}')
    check('B5 the resumed wizard keeps the address (draft created with it)', len(drafts) == 1 and drafts[0]['data'].get('neighborhood'), str(len(drafts)))
    # the real Google endpoint builds the consent URL with that return path in state
    r = await page.request.post(f'{BASE}/api/auth/google', data={'next': '/?sell=resume'})
    j = await r.json()
    from urllib.parse import urlparse, parse_qs
    state = parse_qs(urlparse(j.get('url', '')).query).get('state', [''])[0]
    check('B6 /api/auth/google carries ?sell=resume in OAuth state', state == '/?sell=resume', state)
    r = await page.request.post(f'{BASE}/api/auth/google', data={'next': '//evil.com?sell=resume'})
    state = parse_qs(urlparse((await r.json()).get('url', '')).query).get('state', [''])[0]
    check('B7 unsafe return paths are dropped', state == '', state)
    await ctx.close()

async def navbar(b):
    pages = [('/', 'home'), ('/propiedades', 'marketplace'), ('/propiedad/casa-mburucuya', 'listing'), ('/empresas', 'empresas'), ('/descargar', 'descargar'), ('/feedback', 'feedback'), ('/cuenta/publicaciones', 'cuenta')]
    for width in (360, 390):
        ctx = await b.new_context(viewport={'width': width, 'height': 800}, is_mobile=True, has_touch=True, device_scale_factor=2, locale='es-PY')
        page = await ctx.new_page()
        await page.request.post(f'{BASE}/api/auth/login', data={'email': EMAIL, 'password': PW})
        for path, name in pages:
            await page.goto(f'{BASE}{path}', wait_until='load', timeout=180000)
            av = page.get_by_test_id('nav-avatar')
            try:
                await av.first.wait_for(state='visible', timeout=15000)
                vis = True
            except Exception:
                vis = False
            geo = await page.evaluate("""() => {
              const a = document.querySelector('[data-testid=nav-avatar]');
              if (!a) return null;
              const r = a.getBoundingClientRect();
              const bar = a.closest('nav') || a.parentElement.parentElement;
              const br = bar.getBoundingClientRect();
              return { top: Math.round(r.top), right: Math.round(r.right), barH: Math.round(br.height), overflow: document.documentElement.scrollWidth > window.innerWidth };
            }""")
            ok = vis and geo and geo['right'] <= width and not geo['overflow'] and geo['barH'] <= 72
            check(f'N {width}px {name}: avatar in navbar, one line, no overflow', ok, str(geo))
            if name in ('home', 'listing'):
                await page.screenshot(path=os.path.join(OUT, f'e2e_nav_{width}_{name}.png'), clip={'x': 0, 'y': 0, 'width': width, 'height': 120})
        await ctx.close()
    # signed out: no avatar, header unchanged
    ctx = await b.new_context(viewport={'width': 390, 'height': 800}, is_mobile=True, has_touch=True)
    page = await ctx.new_page()
    await page.goto(f'{BASE}/', wait_until='load')
    await page.wait_for_timeout(2500)
    check('N signed out: no avatar shown', await page.get_by_test_id('nav-avatar').count() == 0)
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await password_and_drafts(b)
        await google_resume(b)
        await navbar(b)
        await b.close()
    failed = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(failed)}/{len(results)} passed')

asyncio.run(main())
