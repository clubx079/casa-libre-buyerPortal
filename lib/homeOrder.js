// Home "featured" strip order: paid Landing listings always first; listings on a free
// first-listing gift (automation) only fill the slots left over, rotated by `seed`
// (the hour) so every free listing gets its turn. Pure — tested in tests/homeOrder.test.mjs.
export function orderHomeFeatured(onHome, freeIds = new Set(), { slots = 6, seed = 0 } = {}) {
  const paid = onHome.filter((l) => !freeIds.has(String(l.id)));
  const free = onHome.filter((l) => freeIds.has(String(l.id)));
  const room = Math.max(0, slots - paid.length);
  if (!room || !free.length) return paid.slice(0, slots);
  const start = ((seed % free.length) + free.length) % free.length;
  const rotated = [...free.slice(start), ...free.slice(0, start)];
  return [...paid.slice(0, slots), ...rotated.slice(0, room)];
}
