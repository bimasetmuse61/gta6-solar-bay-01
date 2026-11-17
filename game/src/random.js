// Solar Bay — random.js
// A tiny seeded generator (mulberry32) so the city, the traffic and the
// screenshot scenes are the same every time a seed is given. The live game
// seeds from the clock; the screenshots seed from the URL (?seed=1).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] from the generator. */
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One element of an array, picked by the generator. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** A stable hash of a string, used to seed one city block from its index. */
export function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
