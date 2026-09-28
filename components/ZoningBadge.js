// "What this area allows to be built" on a listing page — zoned cities only
// (Asunción today). Renders nothing for listings without zoning.
import { categoryLabel, CATEGORY_SHORT } from '@/lib/zoning/categories';

export default function ZoningBadge({ zoning, lang = 'es' }) {
  if (!zoning) return null;
  const es = lang !== 'en';
  const k = es ? 'es' : 'en';
  // Exact limit known (residential zones) → "Media altura · hasta 5 pisos"; otherwise the category's range.
  const headline = zoning.maxFloors && zoning.category !== 'otro'
    ? `${CATEGORY_SHORT[zoning.category]?.[k] || ''} · ${es ? `hasta ${zoning.maxFloors} pisos` : `up to ${zoning.maxFloors} floors`}`
    : categoryLabel(zoning.category, lang);
  return (
    <div className="rounded-[14px] border border-ink/15 bg-card px-4 py-3">
      <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink/45">{es ? 'Zonificación' : 'Zoning'}</div>
      <div className="text-[14px] font-semibold text-ink mt-1">{headline}</div>
    </div>
  );
}
