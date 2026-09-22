// Session handoff: website browser → mobile app (the reverse of /api/auth/handoff).
//
// Someone taps Publish in the app, lands in the system browser, signs in there with
// the email code and publishes. The app itself never saw that login — the browser's
// cookie jar is not the app's. So the success screen links here: we hand the
// browser's session to the app's deep link, and the app exchanges it via
// /api/auth/mobile-exchange. Net effect: publish on the web, come back to the app
// already signed in, with the listing in My listings.
//
// This returns an HTML page rather than a 307 to casalibre://. In-app browsers
// (SFSafariViewController, Chrome Custom Tabs) routinely refuse to follow a SERVER
// redirect into a custom scheme, which silently stranded people on a blank tab.
// A page can try the scheme itself and, if the system still blocks it, offer a
// button — a real tap is a user gesture, which always opens the app.
import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_SCHEME = 'casalibre://auth';

// The app passes its own return URL (?ret=…): a release build uses
// casalibre://auth, Expo Go uses exp://<host>/--/auth. Anything else is ignored,
// so this can never be turned into an open redirect to a website.
function returnBase(param) {
  if (!param) return APP_SCHEME;
  try {
    const u = new URL(param);
    if (u.protocol === 'casalibre:' || u.protocol === 'exp:') return param.split('?')[0];
  } catch { /* not a URL */ }
  return APP_SCHEME;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page({ deepLink, title, body, cta }) {
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>
  :root{color-scheme:light}
  body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:28px;
       background:#F9F4EE;color:#111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center}
  .card{max-width:380px}
  h1{font-size:22px;line-height:1.25;margin:0 0 10px;letter-spacing:-.01em}
  p{font-size:15px;line-height:1.5;color:rgba(17,17,17,.6);margin:0 0 22px}
  a.btn{display:inline-block;background:#111;color:#F9F4EE;text-decoration:none;font-weight:700;font-size:16px;
        padding:15px 30px;border-radius:999px}
  .hint{font-size:13px;color:rgba(17,17,17,.45);margin-top:16px}
</style></head><body>
<div class="card">
  <h1>${esc(title)}</h1>
  <p>${esc(body)}</p>
  <a class="btn" id="go" href="${esc(deepLink)}">${esc(cta)}</a>
  <div class="hint" id="hint"></div>
</div>
<script>
  // Try to bounce straight into the app. If the system blocks the jump (some
  // in-app browsers do), the button above stays — a real tap always works.
  var link = document.getElementById('go').href;
  setTimeout(function () { try { window.location.href = link; } catch (e) {} }, 60);
  setTimeout(function () {
    document.getElementById('hint').textContent = 'Si no volviste automáticamente, tocá el botón.';
  }, 1600);
</script>
</body></html>`;
}

const html = (body) => new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const raw = cookies().get(COOKIE_NAME)?.value;
  const back = returnBase(searchParams.get('ret'));

  // Not signed in in this browser: still offer the way back, without a session.
  if (!raw || !verifyToken(raw)) {
    return html(page({
      deepLink: `${back}?error=1`,
      title: 'Volvé a la app',
      body: 'No encontramos tu sesión en este navegador. Abrí la app e iniciá sesión con tu correo.',
      cta: 'Abrir Casa Libre',
    }));
  }

  const listing = searchParams.get('listing');
  const deepLink = `${back}?token=${encodeURIComponent(raw)}${listing ? `&listing=${encodeURIComponent(listing)}` : ''}`;
  return html(page({
    deepLink,
    title: '¡Listo! Volvé a la app',
    body: 'Tu propiedad quedó publicada. Te llevamos de vuelta a Casa Libre, ya con tu sesión iniciada.',
    cta: 'Abrir Casa Libre',
  }));
}
