"""Mobile navbar: login button (signed out) / avatar (signed in) fits on one line at every phone width."""
import asyncio, os
from playwright.async_api import async_playwright

OUT = os.path.dirname(os.path.abspath(__file__))
BASE = 'http://localhost:3012'
PAGES = [('/', 'home'), ('/propiedades', 'marketplace'), ('/propiedad/casa-mburucuya', 'listing'), ('/empresas', 'empresas'), ('/descargar', 'descargar'), ('/feedback', 'feedback')]
GEO = """(sel) => {
  const a = document.querySelector(sel);
  if (!a) return null;
  const bar = a.closest('nav') || a.parentElement.parentElement;
  const kids = [...bar.querySelectorAll('a,button,span.text-\\\\[20px\\\\]')].filter(e => e.offsetParent !== null);
  const vis = [...bar.children].map(c => c.getBoundingClientRect()).filter(x => x.width && x.height);
  const mid = (x) => x.top + x.height / 2;
  const rows = vis.every(x => Math.abs(mid(x) - mid(vis[0])) < 8) ? 1 : 2;
  const r = a.getBoundingClientRect(), br = bar.getBoundingClientRect();
  // anything in the bar sticking out past the screen edge or overlapping its neighbour?
  let overlap = false;
  const items = [...(a.parentElement.children)].map(e => e.getBoundingClientRect()).filter(x => x.width);
  for (let i = 1; i < items.length; i++) if (items[i].left < items[i-1].right - 0.5) overlap = true;
  return { right: Math.round(r.right), w: Math.round(r.width), barH: Math.round(br.height), rows, overlap,
           docOverflow: document.documentElement.scrollWidth > window.innerWidth };
}"""

results = []
def check(name, ok, detail=''):
    results.append(ok)
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''), flush=True)

async def run(b, width, signed_in):
    ctx = await b.new_context(viewport={'width': width, 'height': 780}, is_mobile=True, has_touch=True, device_scale_factor=2, locale='es-PY')
    page = await ctx.new_page()
    if signed_in:
        await page.request.post(f'{BASE}/api/auth/login', data={'email': 'ana.test@example.com', 'password': 'Secreto123!'})
    sel = '[data-testid=nav-avatar]' if signed_in else '[data-testid=nav-login]'
    for path, name in PAGES:
        await page.goto(f'{BASE}{path}', wait_until='load', timeout=180000)
        try:
            await page.locator(sel).first.wait_for(state='visible', timeout=15000); vis = True
        except Exception:
            vis = False
        g = await page.evaluate(GEO, sel)
        ok = vis and g and g['right'] <= width - 8 and not g['docOverflow'] and not g['overlap'] and g['rows'] <= 1
        check(f"{width}px {'in ' if signed_in else 'out'} {name}", ok, str(g))
        if name in ('home', 'listing'):
            await page.screenshot(path=os.path.join(OUT, f"nav2_{width}_{'in' if signed_in else 'out'}_{name}.png"), clip={'x': 0, 'y': 0, 'width': width, 'height': 110})
    if not signed_in:
        # the login button opens the login modal
        await page.goto(f'{BASE}/', wait_until='load')
        await page.locator(sel).first.click()
        try:
            await page.get_by_role('dialog').first.wait_for(timeout=8000); opened = True
        except Exception:
            opened = False
        check(f'{width}px login button opens the login window', opened)
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w in (320, 360, 390, 430):
            await run(b, w, False)
            await run(b, w, True)
        await b.close()
    print(f'\n{sum(results)}/{len(results)} passed')

asyncio.run(main())
