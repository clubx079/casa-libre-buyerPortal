// Where to land after Google sign-in (carried through OAuth `state`). Only a safe
// relative path is honoured, optionally with `?sell=resume` — which reopens the sell
// wizard at its last step after the full-page redirect. Anything else → null.
const PATH = /^\/[A-Za-z0-9/_-]*$/;

export function safeReturnPath(s) {
  if (typeof s !== 'string') return null;
  const [path, query, ...rest] = s.split('?');
  if (rest.length || !PATH.test(path) || path.startsWith('//')) return null;
  if (query === undefined) return path;
  return query === 'sell=resume' ? `${path}?sell=resume` : null;
}
