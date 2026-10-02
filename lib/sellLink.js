// Every "List for free" / "Sell" link on the site points at /publicar — real links,
// so crawlers, emails and open-in-new-tab still reach that page. SellFlow uses this
// to turn a PLAIN click on one of them into "open the sell wizard over the page I'm
// on" for a signed-out visitor, instead of landing on /publicar's account screen.
export function isSellLinkClick({ href, origin, button = 0, metaKey, ctrlKey, shiftKey, altKey, target, download, defaultPrevented } = {}) {
  if (defaultPrevented || button !== 0 || metaKey || ctrlKey || shiftKey || altKey) return false;
  if ((target && target !== '_self') || download) return false;
  let url;
  try { url = new URL(href, origin); } catch { return false; }
  return url.origin === origin && /^\/publicar\/?$/.test(url.pathname);
}
