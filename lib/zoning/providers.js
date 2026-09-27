// THE place a city gets zoning. To add one later (e.g. Luque): write
// lib/zoning/<city>.js with the same lookup(lat, lng) → { code, category, maxFloors, label } | null
// contract and register it here. A city without a provider is never zoned and
// behaves exactly as before.
import { lookupAsuncionZone } from './asuncion.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export const PROVIDERS = {
  asuncion: { id: 'asuncion', matches: (city) => norm(city).startsWith('asuncion'), lookup: lookupAsuncionZone },
};

export function providerForCity(city) {
  if (!norm(city)) return null;
  return Object.values(PROVIDERS).find((p) => p.matches(city)) || null;
}
