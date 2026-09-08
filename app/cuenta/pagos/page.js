'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';

const T = {
  es: { title: 'Pagos', sub: 'Tu tarjeta guardada y el historial de transacciones', cardTitle: 'Tarjeta guardada', noCard: 'Todavía no tenés una tarjeta guardada. Se guardará automáticamente la primera vez que destaques una propiedad.', histTitle: 'Historial de transacciones', empty: 'Todavía no realizaste ningún pago.', th: { prop: 'Propiedad', amount: 'Monto', status: 'Estado', date: 'Fecha' }, succeeded: 'Exitoso', failed: 'Fallido', deleted: 'Propiedad eliminada', highlight: 'Destacar propiedad', loading: 'Cargando…' },
  en: { title: 'Payments', sub: 'Your saved card and transaction history', cardTitle: 'Saved card', noCard: "You don't have a saved card yet. It's saved automatically the first time you feature a property.", histTitle: 'Transaction history', empty: "You haven't made any payments yet.", th: { prop: 'Property', amount: 'Amount', status: 'Status', date: 'Date' }, succeeded: 'Succeeded', failed: 'Failed', deleted: 'Deleted property', highlight: 'Feature property', loading: 'Loading…' },
};
const brandLabel = (b) => ({ visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express' }[b] || (b ? b[0].toUpperCase() + b.slice(1) : 'Tarjeta'));

export default function PaymentsPage() {
  const [lang] = useLang();
  const t = T[lang];
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/account/payments').then((r) => r.json()).then(setData).catch(() => setData({ card: null, payments: [] }));
  }, []);

  const card = data?.card;
  const payments = data?.payments || [];
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-PY' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } };
  const propLabel = (p) => { const pr = p.property; if (!pr) return t.deleted; return [pr.property_type, pr.neighborhood || pr.city].filter(Boolean).join(' · ') || t.highlight; };

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-[clamp(26px,4vw,36px)] font-bold tracking-display leading-tight">{t.title}</h1>
        <p className="text-[14px] text-ink/55 mt-1">{t.sub}</p>
      </div>

      {/* Saved card */}
      <div className="bg-card border border-ink/15 rounded-card p-5 mb-6 max-w-md">
        <div className="font-mono text-[11px] uppercase tracking-label text-ink/45 mb-3">{t.cardTitle}</div>
        {data === null ? <div className="text-[13px] text-ink/40">{t.loading}</div>
          : card ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-11 h-8 rounded-[6px] bg-ink text-paper grid place-items-center text-[9px] font-bold uppercase tracking-wide">{(card.brand || 'card').slice(0, 4)}</span>
                <div>
                  <div className="font-semibold tracking-head">•••• {card.last4}</div>
                  <div className="text-[11px] text-ink/50">{brandLabel(card.brand)}</div>
                </div>
              </div>
              {card.exp_month && <span className="font-mono text-[12px] text-ink/50">{String(card.exp_month).padStart(2, '0')}/{String(card.exp_year).slice(-2)}</span>}
            </div>
          ) : <div className="text-[13px] text-ink/55">{t.noCard}</div>}
      </div>

      {/* Transaction history */}
      <div className="bg-card border border-ink/15 rounded-card overflow-hidden">
        <div className="font-mono text-[11px] uppercase tracking-label text-ink/45 px-5 pt-5 pb-3">{t.histTitle}</div>
        {data === null ? <div className="px-5 pb-6 text-[13px] text-ink/40">{t.loading}</div>
          : payments.length === 0 ? <div className="px-5 pb-8 pt-2 text-[13px] text-ink/55">{t.empty}</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-ink/45 font-mono text-[11px] uppercase tracking-label border-t border-ink/10">
                    <th className="px-5 py-3 font-medium">{t.th.prop}</th>
                    <th className="px-3 py-3 font-medium">{t.th.amount}</th>
                    <th className="px-3 py-3 font-medium">{t.th.status}</th>
                    <th className="px-5 py-3 font-medium text-right">{t.th.date}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-ink/[.08]">
                      <td className="px-5 py-3">
                        {p.property_id && p.property ? <Link href={`/propiedad/${p.property_id}`} className="font-medium hover:underline">{propLabel(p)}</Link> : <span className="text-ink/55">{propLabel(p)}</span>}
                      </td>
                      <td className="px-3 py-3 font-semibold tabular-nums">US${Number(p.amount_usd).toFixed(0)}</td>
                      <td className="px-3 py-3">
                        {p.status === 'succeeded'
                          ? <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{t.succeeded}</span>
                          : <span className="inline-flex items-center gap-1.5 text-red-700 font-medium" title={p.failure_reason || ''}><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{t.failed}</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-ink/60 tabular-nums">{fmtDate(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}
