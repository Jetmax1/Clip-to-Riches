// Deterministic random utilities. Everything random in the simulation flows through
// these so that tests and saves are reproducible.

/** One step of mulberry32. Returns [value in [0,1), next state]. */
export function nextRandom(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Small stateful RNG wrapper for local, seeded generation. */
export class Rng {
  constructor(public state: number) {}

  next(): number {
    const [v, s] = nextRandom(this.state);
    this.state = s;
    return v;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick from empty list');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  weighted<K extends string>(weights: Record<K, number>): K {
    const entries = Object.entries(weights) as [K, number][];
    const total = entries.reduce((a, [, w]) => a + Math.max(0, w), 0);
    let roll = this.next() * total;
    for (const [k, w] of entries) {
      roll -= Math.max(0, w);
      if (roll <= 0) return k;
    }
    return entries[entries.length - 1]![0];
  }

  /** Standard normal via Box–Muller. */
  normal(): number {
    const u = Math.max(1e-9, this.next());
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

/** Stable 32-bit hash of a string (cyrb-style). */
export function hashString(str: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)) | 0;
}

export function seeded(...parts: (string | number)[]): Rng {
  return new Rng(hashString(parts.join('|')));
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const clamp01 = (v: number): number => clamp(v, 0, 1);
