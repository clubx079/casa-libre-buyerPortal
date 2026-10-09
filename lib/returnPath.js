// Where to land after sign-in (Google: carried through OAuth `state`). Only a safe
// relative path is honoured, optionally with one of a few known queries:
//   ?sell=resume                  — reopens the sell wizard at its last step after the
//                                   full-page redirect
//   ?tab=borradores[&draft=<id>]  — My listings → Drafts, opening that draft in the
//                                   wizard (the "unfinished draft" reminder email link)
// Anything else → null.
const PATH = /^\/[A-Za-z0-9/_-]*$/;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const QUERIES = [/^sell=resume$/, new RegExp(`^tab=borradores(?:&draft=${UUID})?$`, 'i')];

export function safeReturnPath(s) {
  if (typeof s !== 'string') return null;
  const [path, query, ...rest] = s.split('?');
  if (rest.length || !PATH.test(path) || path.startsWith('//')) return null;
  if (query === undefined) return path;
  return QUERIES.some((q) => q.test(query)) ? `${path}?${query}` : null;
}
