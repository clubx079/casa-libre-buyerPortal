// Outbound link campaigns → short, taggable URLs.
//
// Every link we place anywhere (a Reddit reply, an Instagram bio, a Meta ad, an
// email) goes out as  <site>/r/<slug>  which redirects to the real page WITH utm
// parameters attached. Short enough to paste in a comment, and it tells us where
// the visitor came from. Anything that arrives with no utm is organic/direct.
//
// Adding a channel is one line here — no deploy-time config, no database.
//
// slug   → the short code people actually click
// source → utm_source (where it was placed)
// medium → utm_medium (what kind of placement)
// name   → utm_campaign (which push/thread it belongs to)
// to     → destination path on our own site (default: home)

export const CAMPAIGNS = {
  // ── Reddit ────────────────────────────────────────────────────────────────
  rd: { source: 'reddit', medium: 'comment', name: 'reddit_organic' },
  rda: { source: 'reddit', medium: 'comment', name: 'reddit_agent' },
  rdsell: { source: 'reddit', medium: 'comment', name: 'reddit_agent', to: '/guias/como-vender-mi-casa' },
  rdbuy: { source: 'reddit', medium: 'comment', name: 'reddit_agent', to: '/comprar' },
  rdrent: { source: 'reddit', medium: 'comment', name: 'reddit_agent', to: '/alquilar' },

  // ── Social ────────────────────────────────────────────────────────────────
  ig: { source: 'instagram', medium: 'social', name: 'instagram_bio' },
  igs: { source: 'instagram', medium: 'story', name: 'instagram_story' },
  fb: { source: 'facebook', medium: 'social', name: 'facebook_page' },
  tt: { source: 'tiktok', medium: 'social', name: 'tiktok_bio' },

  // ── Paid (Meta / Google ads, once they run) ───────────────────────────────
  meta: { source: 'meta', medium: 'cpc', name: 'meta_ads' },
  metasell: { source: 'meta', medium: 'cpc', name: 'meta_ads_sellers', to: '/vender' },
  gads: { source: 'google', medium: 'cpc', name: 'google_ads' },

  // ── Our own mobile app sending people to the web ─────────────────────────
  // Publish is browser-only, so every listing that starts in the app arrives
  // here. Without a tag these land in 'direct' and look like strangers.
  app: { source: 'mobile_app', medium: 'app', name: 'app_publish' },

  // ── Direct outreach ───────────────────────────────────────────────────────
  wa: { source: 'whatsapp', medium: 'outreach', name: 'manual_outreach' },
  mail: { source: 'email', medium: 'email', name: 'manual_outreach' },
  card: { source: 'print', medium: 'offline', name: 'business_card' },
};

// Only our own paths, and nothing that could bounce to another origin.
const safePath = (p) => (typeof p === 'string' && /^\/[A-Za-z0-9/_.-]*$/.test(p) && !p.startsWith('//') ? p : '/');

export function campaignUrl(site, slug, extra = {}) {
  const c = CAMPAIGNS[String(slug || '').toLowerCase()];
  if (!c) return null;
  const base = String(site || '').replace(/\/$/, '');
  const qs = new URLSearchParams({
    utm_source: c.source,
    utm_medium: c.medium,
    utm_campaign: extra.campaign || c.name,
  });
  // e.g. /r/rda?t=askpy_2026_09 → utm_content=askpy_2026_09, so a single slug can
  // tell one thread from another without adding slugs for each.
  if (extra.content) qs.set('utm_content', String(extra.content).slice(0, 60));
  return `${base}${safePath(c.to || '/')}?${qs.toString()}`;
}

export const campaignSlugs = () => Object.keys(CAMPAIGNS);
