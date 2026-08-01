/** Linear-interpolated percentile of an already-sorted array. q in [0,1]. */
export function percentileSorted(sorted: ArrayLike<number>, q: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0];
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function mean(xs: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i];
  return xs.length ? s / xs.length : NaN;
}

/** Sample standard deviation (n-1 denominator). */
export function stdDev(xs: ArrayLike<number>): number {
  const n = xs.length;
  if (n < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = xs[i] - m;
    s += d * d;
  }
  return Math.sqrt(s / (n - 1));
}

export interface HistogramBin {
  /** Bin lower edge in capital units. */
  lo: number;
  /** Bin upper edge in capital units. */
  hi: number;
  /** Display label for the bin. */
  label: string;
  classic: number;
  adaptive: number;
  /** True for the catch-all bin holding ruined / non-positive terminals. */
  ruinBin: boolean;
}

/**
 * Shared-bin histogram of two terminal-capital samples. Sharing the bin edges is
 * what makes the two strategies comparable at a glance.
 *
 * In log mode non-positive terminals cannot be binned, so they go into a
 * dedicated leftmost "ruined" bin rather than being silently dropped.
 */
export function sharedHistogram(
  classic: ArrayLike<number>,
  adaptive: ArrayLike<number>,
  bins: number,
  logScale: boolean,
  fmt: (v: number) => string,
): HistogramBin[] {
  let lo = Infinity;
  let hi = -Infinity;
  const scan = (xs: ArrayLike<number>) => {
    for (let i = 0; i < xs.length; i++) {
      const v = xs[i];
      if (logScale && !(v > 0)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  };
  scan(classic);
  scan(adaptive);

  const hasRuinBin = logScale && (countNonPositive(classic) > 0 || countNonPositive(adaptive) > 0);

  if (!isFinite(lo) || !isFinite(hi)) {
    // Everything was non-positive: nothing to bin but the ruin bucket.
    return hasRuinBin
      ? [
          {
            lo: 0,
            hi: 0,
            label: "ruined",
            classic: countNonPositive(classic),
            adaptive: countNonPositive(adaptive),
            ruinBin: true,
          },
        ]
      : [];
  }
  if (hi === lo) hi = lo + Math.max(Math.abs(lo) * 1e-6, 1e-9);

  const tx = logScale ? Math.log10 : (v: number) => v;
  const inv = logScale ? (v: number) => Math.pow(10, v) : (v: number) => v;
  const tlo = tx(lo);
  const thi = tx(hi);
  const width = (thi - tlo) / bins;

  const out: HistogramBin[] = [];
  if (hasRuinBin) {
    out.push({
      lo: 0,
      hi: 0,
      label: "ruined",
      classic: countNonPositive(classic),
      adaptive: countNonPositive(adaptive),
      ruinBin: true,
    });
  }
  for (let k = 0; k < bins; k++) {
    const binLo = inv(tlo + k * width);
    const binHi = inv(tlo + (k + 1) * width);
    out.push({ lo: binLo, hi: binHi, label: fmt(binLo), classic: 0, adaptive: 0, ruinBin: false });
  }

  const offset = hasRuinBin ? 1 : 0;
  const fill = (xs: ArrayLike<number>, key: "classic" | "adaptive") => {
    for (let i = 0; i < xs.length; i++) {
      const v = xs[i];
      if (logScale && !(v > 0)) continue;
      let k = Math.floor((tx(v) - tlo) / width);
      if (k < 0) k = 0;
      if (k >= bins) k = bins - 1;
      out[offset + k][key]++;
    }
  };
  fill(classic, "classic");
  fill(adaptive, "adaptive");
  return out;
}

function countNonPositive(xs: ArrayLike<number>): number {
  let n = 0;
  for (let i = 0; i < xs.length; i++) if (!(xs[i] > 0)) n++;
  return n;
}

/** Even-stride downsample that always keeps the first and last sample. */
export function downsample<T>(xs: T[], maxPoints: number): T[] {
  if (xs.length <= maxPoints) return xs;
  const step = (xs.length - 1) / (maxPoints - 1);
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(xs[Math.round(i * step)]);
  return out;
}
