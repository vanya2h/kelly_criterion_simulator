/** Compact money-ish formatting: 12.3k, 4.56M, 0.0012. */
export function fmtCapital(v: number): string {
  if (!isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a === 0) return '0'
  if (a >= 1e12) return (v / 1e12).toFixed(2) + 'T'
  if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B'
  if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M'
  if (a >= 1e4) return (v / 1e3).toFixed(1) + 'k'
  if (a >= 100) return v.toFixed(0)
  if (a >= 1) return v.toFixed(2)
  if (a >= 0.01) return v.toFixed(4)
  return v.toExponential(2)
}

export function fmtPct(v: number, digits = 1): string {
  if (!isFinite(v)) return '—'
  return (v * 100).toFixed(digits) + '%'
}

/** Growth rates are tiny per-bet numbers; show them in basis points too. */
export function fmtGrowth(v: number): string {
  if (!isFinite(v)) return '—'
  return v.toFixed(5)
}

export function fmtNum(v: number, digits = 3): string {
  if (!isFinite(v)) return '—'
  return v.toFixed(digits)
}

export function fmtInt(v: number): string {
  return Math.round(v).toLocaleString('en-US')
}
