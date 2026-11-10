'use client';
// Mi cuenta → Referidos: the user's referral link (copy / share on WhatsApp), what they
// have earned, and the people who used their link — first name + last initial and a
// status only, never their contact details. Data: /api/account/referrals.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { COUNTRY } from '@/lib/country';

const T = {
  es: {
    title: 'Referidos', sub: 'Invitá a otros a publicar en Casa-Libre y ganá días de publicación Verificada',
    loading: 'Cargando…', off: 'El programa de referidos no está disponible en este momento.',
    notVerified: 'Para invitar a otros necesitás una cuenta verificada.', needListing: 'Para invitar a otros necesitás tener al menos una publicación visible.', publish: 'Publicar propiedad',
    linkTitle: 'Tu link', copy: 'Copiar link', copied: 'Copiado', share: 'Compartir por WhatsApp',
    how: 'Cómo funciona',
    step1: 'Compartí tu link con quien quiera vender o alquilar su propiedad.',
    step2: (d) => `La persona crea su cuenta con tu link y publica una propiedad. Su publicación sale Verificada gratis por ${d} días.`,
    step3: (d) => `Cuando su publicación está visible en el sitio, una de tus propiedades recibe ${d} días Verificada gratis.`,
    step4: (n, d, rep) => `Con ${n} invitados que publicaron, una de tus propiedades sale además en la portada durante ${d} días${rep ? ', y otra vez cada ' + n + ' invitados más' : ''}.`,
    note: 'Solo cuentan cuentas nuevas, de personas distintas a vos, con una publicación visible.',
    stats: { clicks: 'Visitas a tu link', signups: 'Se registraron', qualified: 'Publicaron', rewards: 'Premios' },
    rewardsTitle: 'Tus premios', noRewards: 'Todavía no tenés premios. Cada invitado que publique te suma días Verificada.',
    peopleTitle: 'Tus invitados', noPeople: 'Todavía nadie se registró con tu link.',
    type: { referrer: (n) => (n ? `Por invitar a ${n}` : 'Por invitar'), new_user: () => 'Bienvenida por invitación', milestone: () => 'Premio por invitados', manual: () => 'Regalo de Casa-Libre' },
    plan: { verified: 'Verificada', home: 'Verificada + portada' },
    days: (d) => `${d} días`,
    state: { granted: (d) => `Activa hasta el ${d}`, expired: (d) => `Terminó el ${d}`, revoked: () => 'Anulada', pending: () => 'Pendiente' },
    wait: { no_live_listing: 'Publicá una propiedad para activarla', listing_not_live: 'Se activa cuando tu publicación esté visible' },
    person: {
      qualified: 'Publicó: cuenta para tus premios',
      no_listing: 'Se registró, todavía no publicó', checking_photos: 'Publicó, estamos revisando las fotos', payment_pending: 'Publicó, falta el pago',
      duplicate: 'Publicación en revisión', photos_rejected: 'Fotos rechazadas, todavía no cuenta', not_live: 'Publicación no visible todavía',
      rejected: 'No cuenta para premios',
    },
    joined: 'Se registró el', viewListing: 'Ver publicación', own: 'Ese es tu propio link: compartilo con otras personas.',
  },
  en: {
    title: 'Referrals', sub: 'Invite others to list on Casa-Libre and earn free Verified days',
    loading: 'Loading…', off: 'The referral program is not available right now.',
    notVerified: 'You need a verified account to invite others.', needListing: 'You need at least one live listing to invite others.', publish: 'List a property',
    linkTitle: 'Your link', copy: 'Copy link', copied: 'Copied', share: 'Share on WhatsApp',
    how: 'How it works',
    step1: 'Share your link with anyone who wants to sell or rent their property.',
    step2: (d) => `They create an account through your link and list a property. Their listing is Verified free for ${d} days.`,
    step3: (d) => `Once their listing is live, one of your listings gets ${d} free Verified days.`,
    step4: (n, d, rep) => `With ${n} invited people who listed, one of your listings is also on the home page for ${d} days${rep ? ', and again for every ' + n + ' more' : ''}.`,
    note: 'Only new accounts of people other than you, with a live listing, count.',
    stats: { clicks: 'Link visits', signups: 'Signed up', qualified: 'Listed', rewards: 'Rewards' },
    rewardsTitle: 'Your rewards', noRewards: 'No rewards yet. Every invited person who lists adds Verified days.',
    peopleTitle: 'People you invited', noPeople: 'Nobody has signed up with your link yet.',
    type: { referrer: (n) => (n ? `For inviting ${n}` : 'For inviting'), new_user: () => 'Welcome reward', milestone: () => 'Referral milestone', manual: () => 'Gift from Casa-Libre' },
    plan: { verified: 'Verified', home: 'Verified + home page' },
    days: (d) => `${d} days`,
    state: { granted: (d) => `Active until ${d}`, expired: (d) => `Ended ${d}`, revoked: () => 'Cancelled', pending: () => 'Pending' },
    wait: { no_live_listing: 'List a property to activate it', listing_not_live: 'Activates once your listing is live' },
    person: {
      qualified: 'Listed: counts toward your rewards',
      no_listing: 'Signed up, no listing yet', checking_photos: 'Listed, photos being checked', payment_pending: 'Listed, payment pending',
      duplicate: 'Listing under review', photos_rejected: 'Photos rejected, does not count yet', not_live: 'Listing not live yet',
      rejected: 'Does not count for rewards',
    },
    joined: 'Signed up', viewListing: 'View listing', own: "That's your own link: share it with other people.",
  },
};

function Stat({ label, value }) {
  return (
    <div className="bg-card border border-ink/15 rounded-card p-4">
      <div className="font-mono text-[11px] uppercase tracking-label text-ink/45">{label}</div>
      <div className="text-[26px] font-bold tracking-head mt-1">{value}</div>
    </div>
  );
}

export default function ReferralsPage() {
  const [lang] = useLang();
  const t = T[lang] || T.es;
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [own, setOwn] = useState(false);
  useEffect(() => {
    try { setOwn(new URLSearchParams(window.location.search).get('own') === '1'); } catch {}
    fetch('/api/account/referrals', { cache: 'no-store' }).then((r) => r.json()).then(setData).catch(() => setData({ enabled: false }));
  }, []);
  const fmt = (iso) => { try { return new Date(iso).toLocaleDateString(lang === 'es' ? COUNTRY.locale : 'en-US', { day: 'numeric', month: 'long' }); } catch { return ''; } };
  const copy = async () => { try { await navigator.clipboard.writeText(data.url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} };

  const head = (
    <div className="mb-7">
      <h1 className="text-[clamp(26px,4vw,36px)] font-bold tracking-display leading-tight">{t.title}</h1>
      <p className="text-[14px] text-ink/55 mt-1">{t.sub}</p>
    </div>
  );
  if (data === null) return <div>{head}<div className="text-[14px] text-ink/45">{t.loading}</div></div>;
  if (!data.enabled) return <div>{head}<div className="bg-card border border-ink/15 rounded-card p-5 text-[14px] text-ink/60 max-w-xl">{t.off}</div></div>;
  if (data.blocked) {
    return (
      <div>{head}
        <div className="bg-card border border-ink/15 rounded-card p-5 max-w-xl">
          <p className="text-[14px] text-ink/70">{data.blocked === 'need_listing' ? t.needListing : t.notVerified}</p>
          {data.blocked === 'need_listing' && <Link href="/publicar" className="inline-block mt-4 px-5 py-2.5 rounded-pill bg-ink text-paper text-[14px] font-semibold">{t.publish}</Link>}
        </div>
      </div>
    );
  }

  const p = data.program;
  const s = data.stats;
  const waHref = `https://wa.me/?text=${encodeURIComponent(data.shareText)}`;
  return (
    <div>
      {head}
      {own && <div className="mb-5 max-w-3xl rounded-card border border-ink/20 bg-card px-4 py-3 text-[13.5px] text-ink/70">{t.own}</div>}

      <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-5 max-w-5xl">
        <div className="bg-card border border-ink/15 rounded-card p-5">
          <div className="font-mono text-[11px] uppercase tracking-label text-ink/45 mb-3">{t.linkTitle}</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input readOnly value={data.url} onFocus={(e) => e.target.select()} className="flex-1 min-w-0 px-3.5 py-2.5 rounded-input border border-ink/20 bg-paper font-mono text-[13px]" aria-label={t.linkTitle} />
            <button onClick={copy} className="px-5 py-2.5 rounded-pill bg-ink text-paper text-[14px] font-semibold shrink-0">{copied ? t.copied : t.copy}</button>
          </div>
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex mt-3 px-5 py-2.5 rounded-pill border border-ink/30 text-[14px] font-semibold hover:bg-ink/5">{t.share}</a>
        </div>
        <div className="bg-card border border-ink/15 rounded-card p-5">
          <div className="font-mono text-[11px] uppercase tracking-label text-ink/45 mb-3">{t.how}</div>
          <ol className="list-decimal pl-5 space-y-1.5 text-[13.5px] text-ink/75 leading-snug">
            <li>{t.step1}</li>
            {p.newUserDays > 0 && <li>{t.step2(p.newUserDays)}</li>}
            {p.referrerDays > 0 && <li>{t.step3(p.referrerDays)}</li>}
            {p.milestoneEvery > 0 && <li>{t.step4(p.milestoneEvery, p.milestoneDays, p.milestoneRepeat)}</li>}
          </ol>
          <p className="text-[12px] text-ink/50 mt-3">{t.note}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 max-w-5xl">
        <Stat label={t.stats.clicks} value={s.clicks} />
        <Stat label={t.stats.signups} value={s.signups} />
        <Stat label={t.stats.qualified} value={s.qualified} />
        <Stat label={t.stats.rewards} value={s.rewardsGranted + s.rewardsPending} />
      </div>

      <section className="mt-8 max-w-5xl">
        <h2 className="text-[18px] font-bold tracking-head mb-3">{t.rewardsTitle}</h2>
        {!data.rewards.length ? <p className="text-[14px] text-ink/55">{t.noRewards}</p> : (
          <div className="bg-card border border-ink/15 rounded-card divide-y divide-ink/10">
            {data.rewards.map((r) => (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold">{(t.type[r.type] || t.type.manual)(r.from)}</div>
                  <div className="text-[12.5px] text-ink/55">{t.plan[r.plan] || t.plan.verified} · {t.days(r.days)}{r.property ? ` · ${r.property}` : ''}</div>
                </div>
                <div className="text-[13px] text-ink/70 sm:text-right">
                  {r.state === 'pending' ? (t.wait[r.wait] || t.state.pending()) : (t.state[r.state] || t.state.pending)(fmt(r.until))}
                  {r.propertyId && r.state === 'granted' && <> · <Link href={`/propiedad/${r.propertyId}`} className="underline">{t.viewListing}</Link></>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 max-w-5xl">
        <h2 className="text-[18px] font-bold tracking-head mb-3">{t.peopleTitle}</h2>
        {!data.persons.length ? <p className="text-[14px] text-ink/55">{t.noPeople}</p> : (
          <div className="bg-card border border-ink/15 rounded-card divide-y divide-ink/10">
            {data.persons.map((x) => (
              <div key={x.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold">{x.name}</div>
                  <div className="text-[12.5px] text-ink/50">{t.joined} {fmt(x.joinedAt)}</div>
                </div>
                <div className={`text-[13px] sm:text-right ${x.status === 'qualified' ? 'font-semibold' : 'text-ink/60'}`}>
                  {x.status === 'qualified' ? t.person.qualified : x.status === 'rejected' ? t.person.rejected : (t.person[x.hold] || t.person.no_listing)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
