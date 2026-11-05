// Where /publicar sends people: the home page with the sell form already open (app/publicar/page.js).
// Every query parameter is kept (utm_* tracking, app=1 / ret= from the app, r=…); sell=1 is added
// unless the link already says how to open the form (sell=resume|back, publicar=1, auth_error after
// Google sign-in), which components/SellFlow.js handles on the home page. Pure — tests/publicarTarget.test.mjs.
export function publicarTarget(searchParams = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams || {})) for (const x of [].concat(v)) if (x != null) q.append(k, String(x));
  if (!q.has('sell') && !q.has('publicar') && !q.has('auth_error')) q.set('sell', '1');
  return `/?${q.toString()}`;
}
