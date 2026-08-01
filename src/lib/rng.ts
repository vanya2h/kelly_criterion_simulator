/**
 * splitmix32 — small, fast, well-distributed 32-bit PRNG.
 * Deterministic given a seed, which is what makes "same draws for both
 * strategies" and reproducible runs possible.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a = (a + 0x9e3779b9) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad) >>> 0
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97) >>> 0
    return ((t ^= t >>> 15) >>> 0) / 4294967296
  }
}

/**
 * Per-path seed. Mixing the path index through a hash (rather than seed+index)
 * keeps neighbouring paths from starting on correlated streams.
 */
export function pathSeed(seed: number, pathIndex: number): number {
  let h = (seed ^ Math.imul(pathIndex + 1, 0x9e3779b9)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}
