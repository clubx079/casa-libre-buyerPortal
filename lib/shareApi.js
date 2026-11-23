// GET /api/listings/<id>/share and /api/mobile/listings/<id>/share (the same answer) —
// the listing's share kit for anyone; stats + the reward line only for the signed-in owner
// (session cookie; the app sends its cookie too) or an admin (Authorization: Bearer <CRON_SECRET>).
//   ?lang=es|en|pt|all   captions in that language (es default); `captionsI18n` has each asked one
// → { listing_id, code, links:{ig,fb,wa,x,tt,li,copy,qr}, captions:{ig,fb,wa,x,tt,li},
//     captionSource:'ai'|'template', images:{story,square,og}, owner:boolean,
//     stats?: { visits, contacts, signups, byChannel:{ig:{visits,contacts},…}, last7:{visits,contacts}, prev7:{visits,contacts} } | null,
//     reward?: { active:false } | { active:true, visits, days, plan, es, en, pt, earned:boolean } }
import 'server-only';
import { NextResponse } from 'next/server';
import * as db from './db';
import { getSession } from './auth';
import { getListing } from './listings';
import { publicOrigin } from './publicOrigin';
import { buildShareKit, listingOwner } from './shareKit';
import { listingShareStats } from './shareStats';
import { shareRewardConfig, rewardText, SHARE_REWARD_ID } from './shareReward';
import { rewardsFor } from './automations/shareListing';
import { LANGS } from './shareCaptions';
import { sharerCode, withSharer } from './shareLinks';

export async function shareResponse(req, id, { headers = {} } = {}) {
  try {
    const l = await getListing(id);
    if (!l) return NextResponse.json({ error: 'not_found' }, { status: 404, headers });
    const asked = String(new URL(req.url).searchParams.get('lang') || 'es').toLowerCase();
    const lang = LANGS.includes(asked) ? asked : 'es';
    const langs = asked === 'all' ? LANGS : [lang];

    const ownerRow = await listingOwner(l.id);
    const session = getSession();
    const secret = process.env.CRON_SECRET;
    const admin = !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
    const owner = !!(session && ownerRow?.created_by && String(session.uid) === String(ownerRow.created_by));

    const built = await buildShareKit(l, { origin: publicOrigin(req), lang, langs: langs.length > 1 || lang !== 'es' ? langs : null });
    // a signed-in person's links carry who shared (…&s=<sharer>), so the clicks are theirs
    const sharer = session?.uid ? sharerCode(String(session.uid)) : null;
    const kit = sharer ? { ...built, links: withSharer(built.links, sharer), captions: withSharer(built.captions, sharer), ...(built.captionsI18n ? { captionsI18n: withSharer(built.captionsI18n, sharer) } : {}) } : built;
    const captions = lang === 'es' ? kit.captions : kit.captionsI18n?.[lang] || kit.captions;
    const body = { listing_id: l.id, ...kit, captions, owner, ...(sharer ? { sharer } : {}) };

    if (owner || admin) {
      const [stats, rewardRow] = await Promise.all([
        listingShareStats(l.id),
        db.select('automations', `id=eq.${SHARE_REWARD_ID}&limit=1`).then((r) => r[0] || null).catch(() => null),
      ]);
      body.stats = stats;
      const cfg = shareRewardConfig(rewardRow);
      const text = rewardText(cfg);
      if (text.active) {
        const given = await rewardsFor(db, [l.id]).catch(() => []);
        text.earned = given.length > 0;
      }
      body.reward = text;
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': owner || admin ? 'private, no-store' : 'public, max-age=300, s-maxage=600', ...headers } });
  } catch (e) {
    return NextResponse.json({ error: 'failed', detail: String(e?.message || e).slice(0, 200) }, { status: 500, headers });
  }
}
