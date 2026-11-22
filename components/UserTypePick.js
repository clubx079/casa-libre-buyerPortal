'use client';
// "¿Sos vendedor o comprador?" — the two round pills, the SAME look as the sell wizard's
// "Vender / Alquilar" choice (components/SellFlow.js pickCls). Used on the log-in screen
// (optional, AuthModal), right after a log-in sign-up (AuthModal 'type' step) and by
// UserTypePrompt (Google sign-ups land back on the page). lib/userType.js has the rules.
import { useLang } from '@/lib/useLang';

export const TYPE_DICT = {
  es: {
    q: '¿Sos vendedor o comprador?', seller: 'Vendedor', buyer: 'Comprador',
    hint: 'Vendedor: vendés o alquilás una propiedad. Comprador: buscás para comprar o alquilar.',
    sub: 'Así te mostramos lo que te sirve.', optional: 'Opcional', saving: 'Guardando…', later: 'Ahora no',
  },
  en: {
    q: 'Are you a seller or a buyer?', seller: 'Seller', buyer: 'Buyer',
    hint: 'Seller: you sell or rent out a property. Buyer: you are looking to buy or rent.',
    sub: 'So we show you what is useful to you.', optional: 'Optional', saving: 'Saving…', later: 'Not now',
  },
  pt: {
    q: 'Você é vendedor ou comprador?', seller: 'Vendedor', buyer: 'Comprador',
    hint: 'Vendedor: você vende ou aluga um imóvel. Comprador: você procura para comprar ou alugar.',
    sub: 'Assim mostramos o que é útil para você.', optional: 'Opcional', saving: 'Salvando…', later: 'Agora não',
  },
};

// Same classes as SellFlow's pickCls (round pills, ink when picked).
export const pickCls = (on) => `flex-1 px-5 py-3.5 rounded-pill border-[1.5px] text-[15px] font-semibold transition-colors ${on ? 'bg-ink text-paper border-ink' : 'bg-card border-ink hover:bg-hatch2'}`;

// A pick made on the log-in screen survives the Google round trip (full-page redirect):
// localStorage, 30 minutes. UserTypePrompt sends it once the session is back.
const PICK_KEY = 'cl_user_type_pick';
const PICK_TTL = 30 * 60e3;
export function savePick(type) {
  try { if (type) localStorage.setItem(PICK_KEY, JSON.stringify({ type, at: Date.now() })); else localStorage.removeItem(PICK_KEY); } catch {}
}
export function readPick() {
  try {
    const p = JSON.parse(localStorage.getItem(PICK_KEY) || 'null');
    if (p && (p.type === 'seller' || p.type === 'buyer') && Date.now() - Number(p.at) < PICK_TTL) return p.type;
  } catch {}
  return null;
}

export async function postUserType(type, source) {
  try {
    const r = await fetch('/api/account/user-type', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, source }) });
    const j = await r.json().catch(() => ({}));
    return !!j.ok;
  } catch { return false; }
}

// value: 'seller' | 'buyer' | null. onPick(type). compact = smaller title (log-in screen).
export default function UserTypePick({ value = null, onPick, compact = false, disabled = false, showHint = true }) {
  const [lang] = useLang();
  const t = TYPE_DICT[lang] || TYPE_DICT.es;
  return (
    <div data-testid="user-type-pick">
      <div className={compact ? 'text-[13px] font-semibold mb-2' : 'text-[22px] font-bold tracking-head mb-4'}>
        {t.q}{compact && <span className="font-normal text-ink/45"> · {t.optional}</span>}
      </div>
      <div className="flex gap-3">
        <button type="button" disabled={disabled} onClick={() => onPick?.('seller')} className={pickCls(value === 'seller')} data-testid="user-type-seller">{t.seller}</button>
        <button type="button" disabled={disabled} onClick={() => onPick?.('buyer')} className={pickCls(value === 'buyer')} data-testid="user-type-buyer">{t.buyer}</button>
      </div>
      {showHint && <p className="mt-2 text-[12px] leading-snug text-ink/50">{t.hint}</p>}
    </div>
  );
}

// "Ahora no" on the question: don't ask again in this browser session.
export const LATER_KEY = 'cl_user_type_later';
