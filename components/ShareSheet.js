'use client';
// The share kit of a listing (GET /api/listings/<id>/share): the ready-made image (story /
// post), a caption per network, one button per network, and — for the owner — what the
// share links brought this week + the reward, when it is on.
//   <ShareSheet listingId open onClose source />      modal (listing page, Mis publicaciones)
//   <ShareSheet listingId inline source />            inline panel (sell success, /compartir/<id>)
// On phones the main button uses the Web Share API with the image file + caption
// (navigator.share({ files }) when canShare), else the network buttons do it one by one.
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '@/lib/useLang';
import { track } from '@/lib/analytics';
import { networkUrls, shareLinks, sharerCode, withSharer } from '@/lib/shareLinks';
import { useAuth } from '@/components/AuthProvider';

const L = {
  es: {
    titleOwner: 'Compartí tu propiedad', title: 'Compartir esta propiedad',
    subOwner: 'Cada link es tuyo: sabemos cuántas personas llegan por cada red.',
    sub: 'Mandala a quien esté buscando.',
    shareNow: 'Compartir', story: 'Historia', post: 'Post', text: 'Texto para', copyText: 'Copiar texto', copied: '¡Copiado!',
    copyLink: 'Copiar link', dlStory: 'Descargar historia', dlPost: 'Descargar post', linkCopied: 'Link copiado',
    igDone: 'Imagen descargada y texto copiado. Abrí Instagram, subí la historia y pegá el texto (o el link en un sticker).',
    ttDone: 'Imagen descargada y texto copiado. Abrí TikTok, subí la imagen y pegá el texto.',
    week: (v, c) => `Tu link trajo ${v} ${v === 1 ? 'visita' : 'visitas'} y ${c} ${c === 1 ? 'contacto' : 'contactos'} esta semana.`,
    total: (v, c) => `En total: ${v} ${v === 1 ? 'visita' : 'visitas'} · ${c} ${c === 1 ? 'contacto' : 'contactos'}`,
    earned: '¡Ya ganaste el premio con esta propiedad!',
    loading: 'Preparando tu kit…', failed: 'No pudimos cargar el kit. Probá de nuevo.', close: 'Cerrar',
    more: 'Imagen y textos para publicar', mailSubject: 'Mirá esta propiedad en Casa-Libre', msg: 'Mirá esta propiedad en Casa-Libre:',
    igCopied: 'Link copiado: pegalo en tu mensaje o historia de Instagram.',
  },
  en: {
    titleOwner: 'Share your listing', title: 'Share this listing',
    subOwner: 'Each link is yours: we count how many people come from each network.',
    sub: 'Send it to someone who is looking.',
    shareNow: 'Share', story: 'Story', post: 'Post', text: 'Text for', copyText: 'Copy text', copied: 'Copied!',
    copyLink: 'Copy link', dlStory: 'Download story', dlPost: 'Download post', linkCopied: 'Link copied',
    igDone: 'Image downloaded and text copied. Open Instagram, post the story and paste the text (or the link in a sticker).',
    ttDone: 'Image downloaded and text copied. Open TikTok, upload the image and paste the text.',
    week: (v, c) => `Your link brought ${v} ${v === 1 ? 'visit' : 'visits'} and ${c} ${c === 1 ? 'contact' : 'contacts'} this week.`,
    total: (v, c) => `All time: ${v} ${v === 1 ? 'visit' : 'visits'} · ${c} ${c === 1 ? 'contact' : 'contacts'}`,
    earned: 'You already earned the reward with this listing!',
    loading: 'Preparing your kit…', failed: "We couldn't load the kit. Try again.", close: 'Close',
    more: 'Image and texts to post', mailSubject: 'Take a look at this property on Casa-Libre', msg: 'Take a look at this property on Casa-Libre:',
    igCopied: 'Link copied: paste it in your Instagram message or story.',
  },
  pt: {
    titleOwner: 'Compartilhe seu imóvel', title: 'Compartilhar este imóvel',
    subOwner: 'Cada link é seu: contamos quantas pessoas chegam por cada rede.',
    sub: 'Envie para quem está procurando.',
    shareNow: 'Compartilhar', story: 'Story', post: 'Post', text: 'Texto para', copyText: 'Copiar texto', copied: 'Copiado!',
    copyLink: 'Copiar link', dlStory: 'Baixar story', dlPost: 'Baixar post', linkCopied: 'Link copiado',
    igDone: 'Imagem baixada e texto copiado. Abra o Instagram, publique o story e cole o texto (ou o link num sticker).',
    ttDone: 'Imagem baixada e texto copiado. Abra o TikTok, envie a imagem e cole o texto.',
    week: (v, c) => `Seu link trouxe ${v} ${v === 1 ? 'visita' : 'visitas'} e ${c} ${c === 1 ? 'contato' : 'contatos'} esta semana.`,
    total: (v, c) => `No total: ${v} ${v === 1 ? 'visita' : 'visitas'} · ${c} ${c === 1 ? 'contato' : 'contatos'}`,
    earned: 'Você já ganhou o prêmio com este imóvel!',
    loading: 'Preparando seu kit…', failed: 'Não foi possível carregar o kit. Tente de novo.', close: 'Fechar',
    more: 'Imagem e textos para publicar', mailSubject: 'Veja este imóvel na Casa-Libre', msg: 'Veja este imóvel na Casa-Libre:',
    igCopied: 'Link copiado: cole na sua mensagem ou story do Instagram.',
  },
};

// The networks of the top row (Omar, Nov 23): WhatsApp, Instagram, Gmail, X (LinkedIn removed) — their
// real marks (Simple Icons paths). Each opens that network straight away with its own tracked link.
const IG_BG = 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)';
const ICON_ROW = [
  { c: 'wa', name: 'WhatsApp', bg: '#25D366', fg: '#fff', d: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z', size: 26 },
  // Instagram (Nov 24): the glyph — rounded square + lens + dot — drawn centred in the 24x24 box at
  // the same optical size as WhatsApp / Gmail (evenodd fill, so the rings stay open)
  { c: 'ig', name: 'Instagram', bg: IG_BG, fg: '#fff', evenodd: true, d: 'M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9ZM12 7.25a4.75 4.75 0 1 1 0 9.5 4.75 4.75 0 0 1 0-9.5Zm0 1.9a2.85 2.85 0 1 0 0 5.7 2.85 2.85 0 0 0 0-5.7Zm5.2-3.55a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z', size: 26 },
  { c: 'em', name: 'Gmail', bg: '#fff', fg: '#EA4335', ring: true, d: 'M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z', size: 26 },
  { c: 'x', name: 'X', bg: '#000', fg: '#fff', d: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z', size: 21 },
];

const NETS = [
  ['wa', 'WhatsApp', '#25D366'], ['ig', 'Instagram', '#E1306C'], ['fb', 'Facebook', '#1877F2'],
  ['tt', 'TikTok', '#111111'], ['x', 'X', '#111111'],
];

async function blobOf(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('image');
  return r.blob();
}
async function download(url, name) {
  const b = await blobOf(url);
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export default function ShareSheet({ listingId, title = '', open = true, onClose, inline = false, source = 'listing' }) {
  const [lang] = useLang();
  const t = L[lang] || L.es;
  const auth = useAuth();
  const me = auth?.user?.id || null;
  const [kit, setKit] = useState(null);
  const [err, setErr] = useState(false);
  const [fmt, setFmt] = useState('story');
  const [net, setNet] = useState('wa');
  const [toast, setToast] = useState('');
  const [canFiles, setCanFiles] = useState(false);

  useEffect(() => {
    if (!open || !listingId) return undefined;
    let gone = false;
    setErr(false);
    fetch(`/api/listings/${encodeURIComponent(listingId)}/share?lang=${lang}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('x'))))
      .then((j) => { if (!gone) { setKit(j); track('share_sheet_opened', { listing_id: listingId, source, owner: !!j.owner }); } })
      .catch(() => { if (!gone) setErr(true); });
    return () => { gone = true; };
  }, [open, listingId, lang, source]);

  useEffect(() => {
    try { setCanFiles(!!navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] })); } catch { setCanFiles(false); }
  }, []);

  useEffect(() => {
    if (!open || inline) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, inline, onClose]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };
  const shared = useCallback((channel, extra = {}) => track('listing_shared', { listing_id: listingId, channel, source, tracked: true, ...extra }), [listingId, source]);

  if (!open) return null;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const sharer = me ? sharerCode(String(me)) : null;
  const links = kit?.links || withSharer(shareLinks(origin, listingId), sharer);
  const caption = (c) => kit?.captions?.[c] || `${t.msg}${title ? ` ${title}` : ''}\n${links[c] || links.copy}`;
  const imgUrl = kit ? (fmt === 'story' ? kit.images.story : kit.images.square) : '';
  const fileName = (f) => `casa-libre-${kit?.code || 'propiedad'}-${f}.png`;
  const direct = networkUrls({ links, captions: { wa: caption('wa'), x: caption('x') }, subject: title ? `${t.mailSubject}: ${title}` : t.mailSubject });
  // top row: open the network straight away (Instagram has no web share link: the phone's share
  // menu when there is one, else image + text ready and Instagram opened)
  const quick = (c) => {
    if (c === 'ig') {
      const phone = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches && navigator.share;
      if (phone) { navigator.share({ text: caption('ig'), url: links.ig }).then(() => shared('ig', { via: 'native' })).catch(() => {}); return; }
      window.open('https://www.instagram.com/direct/inbox/', '_blank', 'noopener,noreferrer');
      copy(links.ig);
      shared('ig');
      return;
    }
    if (direct[c]) { window.open(direct[c], '_blank', 'noopener,noreferrer'); shared(c); }
  };

  const nativeShare = async () => {
    // the WhatsApp text, with the copy link (we can't know which app they pick)
    const text = caption('wa').replace(kit.links.wa, kit.links.copy);
    try {
      if (canFiles) {
        const b = await blobOf(imgUrl);
        const file = new File([b], fileName(fmt), { type: 'image/png' });
        await navigator.share({ files: [file], text });
      } else {
        await navigator.share({ text, url: kit.links.copy });
      }
      shared('native', { with_image: canFiles });
    } catch { /* cancelled */ }
  };
  const onNet = async (c) => {
    setNet(c);
    if (direct[c]) {
      shared(c);
      window.open(direct[c], '_blank', 'noopener,noreferrer');
      return;
    }
    // Instagram / TikTok: no web share link → the image is downloaded and the text copied
    try { await download(c === 'ig' ? kit.images.story : kit.images.square, fileName(c === 'ig' ? 'story' : 'post')); } catch { /* still copy the text */ }
    await copy(caption(c));
    shared(c);
    flash(c === 'ig' ? t.igDone : t.ttDone);
    setTimeout(() => window.open(c === 'ig' ? 'https://www.instagram.com/' : 'https://www.tiktok.com/upload', '_blank', 'noopener,noreferrer'), 600);
  };

  const stats = kit?.stats;
  // Compact (Omar, Nov 23): title, then one row — the five networks + Copy link, all the same round
  // buttons. The image / caption kit is gone from the sheet; the owner still sees what the links brought.
  // a standard filled chain-link glyph (Material "link"), centred, same fill weight as the brand marks
  const LINK_ICON = 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1ZM8 13h8v-2H8v2Zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5Z';
  const row = [...ICON_ROW, { c: 'copy', name: t.copyLink, bg: '#F1ECE2', fg: '#1A1A1A', ring: true, d: LINK_ICON, size: 26 }];
  const onIcon = async (c) => {
    if (c !== 'copy') { quick(c); return; }
    if (await copy(links.copy)) { flash(t.linkCopied); shared('copy'); }
  };
  const body = (
    <div className="flex flex-col gap-3.5">
      <div className="pr-8">
        <h3 className="text-[17px] font-bold tracking-head leading-tight">{kit?.owner ? t.titleOwner : t.title}</h3>
        <p className="text-[12.5px] text-ink/55 mt-0.5">{kit?.owner ? t.subOwner : t.sub}</p>
      </div>

      {kit?.owner && (stats || kit.reward?.active) && (
        <div className="rounded-[12px] border border-ink/15 bg-card px-3 py-2 text-[12.5px] flex flex-col gap-0.5" data-testid="share-stats">
          {stats && <div className="font-bold">{t.week(stats.last7?.visits || 0, stats.last7?.contacts || 0)}</div>}
          {stats && (stats.visits > 0 || stats.contacts > 0) && <div className="text-ink/60">{t.total(stats.visits, stats.contacts)}</div>}
          {kit.reward?.active && <div className="font-semibold">{kit.reward.earned ? t.earned : (kit.reward[lang] || kit.reward.es)}</div>}
        </div>
      )}

      <div className="grid grid-cols-5 gap-1" data-testid="share-row-icons">
        {row.map(({ c, name, bg, fg, d, size, ring, evenodd }) => (
          <button key={c} onClick={() => onIcon(c)} data-testid={c === 'copy' ? 'share-copy' : `share-icon-${c}`} aria-label={name} className="group flex flex-col items-center gap-1 py-0.5 min-w-0">
            <span className={`w-[46px] h-[46px] rounded-full flex items-center justify-center transition-transform group-hover:-translate-y-0.5 ${ring ? 'border border-ink/15' : ''}`} style={{ background: bg, color: fg }}>
              <svg viewBox="0 0 24 24" width={Math.round(size * 0.85)} height={Math.round(size * 0.85)} fill="currentColor" aria-hidden><path d={d} fillRule={evenodd ? 'evenodd' : undefined} clipRule={evenodd ? 'evenodd' : undefined} /></svg>
            </span>
            <span className="text-[10.5px] font-semibold text-ink/70 leading-tight text-center truncate w-full">{name}</span>
          </button>
        ))}
      </div>

      {toast && <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[2100] max-w-[90vw] bg-ink text-paper text-[13px] font-semibold px-4 py-2.5 rounded-pill shadow-hard-soft" role="status">{toast}</div>}
    </div>
  );

  if (inline) return <div className="text-left">{body}</div>;
  if (typeof document === 'undefined') return null;
  // in a portal, and clicks stopped here: the sheet opens from inside clickable cards / the gallery
  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-[440px] max-h-[92vh] overflow-y-auto bg-paper border-[1.5px] border-ink rounded-t-[20px] sm:rounded-[20px] shadow-hard p-4 sm:p-5">
        <button onClick={onClose} aria-label={t.close} className="absolute top-3 right-3 w-8 h-8 rounded-pill border border-ink/20 hover:border-ink flex items-center justify-center text-[16px]">×</button>
        {body}
      </div>
    </div>,
    document.body,
  );
}

