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
import { networkUrls } from '@/lib/shareLinks';

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
  },
};

const NETS = [
  ['wa', 'WhatsApp', '#25D366'], ['ig', 'Instagram', '#E1306C'], ['fb', 'Facebook', '#1877F2'],
  ['tt', 'TikTok', '#111111'], ['x', 'X', '#111111'], ['li', 'LinkedIn', '#0A66C2'],
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

export default function ShareSheet({ listingId, open = true, onClose, inline = false, source = 'listing' }) {
  const [lang] = useLang();
  const t = L[lang] || L.es;
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
  const caption = (c) => kit?.captions?.[c] || kit?.links?.[c] || '';
  const imgUrl = kit ? (fmt === 'story' ? kit.images.story : kit.images.square) : '';
  const fileName = (f) => `casa-libre-${kit?.code || 'propiedad'}-${f}.png`;
  const direct = kit ? networkUrls({ links: kit.links, captions: kit.captions }) : {};

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
  const body = (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-[20px] font-bold tracking-head leading-tight">{kit?.owner ? t.titleOwner : t.title}</h3>
        <p className="text-[13px] text-ink/60 mt-1">{kit?.owner ? t.subOwner : t.sub}</p>
      </div>

      {kit?.owner && (stats || kit.reward?.active) && (
        <div className="rounded-[14px] border-[1.5px] border-ink bg-card px-4 py-3 text-[13px] flex flex-col gap-1" data-testid="share-stats">
          {stats && <div className="font-bold">{t.week(stats.last7?.visits || 0, stats.last7?.contacts || 0)}</div>}
          {stats && (stats.visits > 0 || stats.contacts > 0) && <div className="text-ink/60">{t.total(stats.visits, stats.contacts)}</div>}
          {kit.reward?.active && <div className="font-semibold">🎁 {kit.reward.earned ? t.earned : (kit.reward[lang] || kit.reward.es)}</div>}
        </div>
      )}

      {err && <div className="text-[13px] text-red-700">{t.failed}</div>}
      {!kit && !err && <div className="font-mono text-[12px] text-ink/50 py-8 text-center">{t.loading}</div>}

      {kit && (
        <>
          <div className="flex gap-4 max-[520px]:flex-col">
            <div className="shrink-0 flex flex-col items-center gap-2">
              <div className="inline-flex rounded-pill border-[1.5px] border-ink p-0.5 text-[12px] font-semibold">
                {[['story', t.story], ['square', t.post]].map(([k, lb]) => (
                  <button key={k} onClick={() => setFmt(k)} className={`px-3 py-1 rounded-pill ${fmt === k ? 'bg-ink text-paper' : ''}`}>{lb}</button>
                ))}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl} alt="" className={`border-[1.5px] border-ink rounded-[12px] bg-card object-cover ${fmt === 'story' ? 'w-[150px] h-[267px]' : 'w-[200px] h-[200px]'}`} />
              <button onClick={() => download(imgUrl, fileName(fmt)).then(() => shared(fmt === 'story' ? 'download_story' : 'download_post')).catch(() => {})} className="text-[12px] font-semibold underline">{fmt === 'story' ? t.dlStory : t.dlPost}</button>
            </div>

            <div className="flex-1 flex flex-col gap-3 min-w-0">
              {typeof navigator !== 'undefined' && navigator.share && (
                <button onClick={nativeShare} className="w-full py-3 rounded-pill bg-ink text-paper font-bold text-[15px] shadow-hard-soft" data-testid="share-native">{t.shareNow}</button>
              )}
              <div className="grid grid-cols-3 gap-2">
                {NETS.map(([c, name, color]) => (
                  <button key={c} onClick={() => onNet(c)} data-testid={`share-${c}`} className={`py-2.5 rounded-[12px] border-[1.5px] text-[12.5px] font-bold flex items-center justify-center gap-1.5 ${net === c ? 'border-ink bg-card' : 'border-ink/20 hover:border-ink'}`}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />{name}
                  </button>
                ))}
              </div>
              <button onClick={async () => { if (await copy(kit.links.copy)) { flash(t.linkCopied); shared('copy'); } }} className="w-full py-2.5 rounded-pill border-[1.5px] border-ink text-[13px] font-bold" data-testid="share-copy">{t.copyLink}</button>
              <div>
                <div className="text-[11px] font-mono text-ink/50 mb-1">{t.text} {NETS.find(([c]) => c === net)?.[1]}</div>
                <textarea readOnly value={caption(net)} rows={5} className="w-full text-[12.5px] leading-snug border-[1.5px] border-ink/20 rounded-[12px] p-2.5 bg-card resize-none" />
                <button onClick={async () => { if (await copy(caption(net))) flash(t.copied); }} className="mt-1 text-[12px] font-semibold underline">{t.copyText}</button>
              </div>
            </div>
          </div>
        </>
      )}
      {toast && <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[2100] max-w-[90vw] bg-ink text-paper text-[13px] font-semibold px-4 py-2.5 rounded-pill shadow-hard-soft" role="status">{toast}</div>}
    </div>
  );

  if (inline) return <div className="text-left">{body}</div>;
  if (typeof document === 'undefined') return null;
  // in a portal, and clicks stopped here: the sheet opens from inside clickable cards / the gallery
  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-[640px] max-h-[92vh] overflow-y-auto bg-paper border-[1.5px] border-ink rounded-t-[22px] sm:rounded-[22px] shadow-hard p-5 sm:p-7">
        <button onClick={onClose} aria-label={t.close} className="absolute top-3 right-3 w-9 h-9 rounded-pill border border-ink/20 hover:border-ink flex items-center justify-center text-[18px]">×</button>
        {body}
      </div>
    </div>,
    document.body,
  );
}

