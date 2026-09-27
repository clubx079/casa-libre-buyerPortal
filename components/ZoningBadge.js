// "What this area allows to be built" on a listing page — zoned cities only
// (Asunción today). Renders nothing for listings without zoning.
import { categoryLabel, ZONING_SOURCE_LABEL } from '@/lib/zoning/categories';

export default function ZoningBadge({ zoning, lang = 'es' }) {
  if (!zoning) return null;
  const es = lang !== 'en';
  const floors = zoning.maxFloors ? (es ? `hasta ${zoning.maxFloors} pisos` : `up to ${zoning.maxFloors} floors`) : null;
  return (
    <div className="rounded-[14px] border border-ink/15 bg-card px-4 py-3">
      <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink/45">{es ? 'Zonificación' : 'Zoning'}</div>
      <div className="text-[14px] font-semibold text-ink mt-1">
        {categoryLabel(zoning.category, lang)}{floors && zoning.category !== 'otro' ? ` · ${floors}` : ''}
      </div>
      <div className="text-[11.5px] leading-snug text-ink/55 mt-1">
        {es ? 'Fuente' : 'Source'}: {ZONING_SOURCE_LABEL[zoning.source] || zoning.source}{zoning.code ? ` · ${zoning.code}` : ''}.{' '}
        {es
          ? 'Referencia: lo que la zona permite construir, no lo ya construido. Verificá con la Municipalidad.'
          : 'Reference only: what the zone allows to be built, not what is built. Check with the municipality.'}
      </div>
    </div>
  );
}
