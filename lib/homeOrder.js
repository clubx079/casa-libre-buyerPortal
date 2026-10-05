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

// The full strip, always `slots` cards when there are enough listings:
//   1. paid Landing + free gifts (orderHomeFeatured above)
//   2. other Verified listings, rotated by `seed` so each gets its turn
//   3. regular listings (`others`, already in the order to use) for what's left.
// A listing never appears twice.
export function fillHomeFeatured({ onHome = [], freeIds = new Set(), verified = [], others = [], slots = 6, seed = 0 } = {}) {
  const out = orderHomeFeatured(onHome, freeIds, { slots, seed });
  const seen = new Set(out.map((l) => String(l.id)));
  const add = (list) => {
    for (const l of list) {
      if (out.length >= slots) return;
      const id = String(l.id);
      if (seen.has(id)) continue;
      seen.add(id); out.push(l);
    }
  };
  if (verified.length) {
    const start = ((seed % verified.length) + verified.length) % verified.length;
    add([...verified.slice(start), ...verified.slice(0, start)]);
  }
  add(others);
  return out;
}
