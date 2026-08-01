import { CANNOT_FUND, adaptiveLambda, kellyFraction, stakeFor } from './kelly'
import { makeRng, pathSeed } from './rng'
import { mean, percentileSorted, stdDev } from './stats'
import type { Band, Params, PathTrace, SimResult, StrategyResult, StrategyStats } from './types'

/** Effective knobs after the enable-toggles are folded in. */
function effective(p: Params) {
  return {
    minBet: p.minBetEnabled ? Math.max(p.minBet, 0) : 0,
    ruinFloor: p.ruinFloorEnabled ? Math.max(p.ruinFloor, 0) : 0,
  }
}

interface PathOutcome {
  classicFinal: number
  adaptiveFinal: number
  classicDD: number
  adaptiveDD: number
  classicRuin: number
  adaptiveRuin: number
}

interface RunPathOpts {
  /** Bet counts at which capital is recorded into the cp* arrays. Must start at 0 and end at N. */
  checkpoints?: number[]
  cpClassic?: Float64Array
  cpAdaptive?: Float64Array
  /** Row offset into the cp* arrays for this path. */
  cpOffset?: number
  /** Full per-bet trace, length N+1. */
  traceClassic?: Float64Array
  traceAdaptive?: Float64Array
}

/**
 * Runs one path for BOTH strategies against the same random draws.
 *
 * The shared draw is the whole point: any difference in the two curves is the
 * sizing rule, never luck. A ruined strategy freezes at its final capital while
 * the other keeps playing the same coin flips.
 */
function runPath(p: Params, fStar: number, pathIndex: number, opts: RunPathOpts): PathOutcome {
  const { minBet, ruinFloor } = effective(p)
  // `p.seed` is always the seed actually in force — the UI rerolls it on the Run
  // button and writes it back, so any path can be replayed exactly.
  const rng = makeRng(pathSeed(p.seed, pathIndex))

  let cc = p.C0
  let ca = p.C0
  let ccPeak = p.C0
  let caPeak = p.C0
  let ccDD = 0
  let caDD = 0
  let ccRuin = -1
  let caRuin = -1

  const cps = opts.checkpoints
  const base = (opts.cpOffset ?? 0) * (cps ? cps.length : 0)
  let nextCp = 1
  if (cps && opts.cpClassic && opts.cpAdaptive) {
    opts.cpClassic[base] = cc
    opts.cpAdaptive[base] = ca
  }
  if (opts.traceClassic) opts.traceClassic[0] = cc
  if (opts.traceAdaptive) opts.traceAdaptive[0] = ca

  for (let i = 0; i < p.N; i++) {
    const win = rng() < p.p

    if (ccRuin < 0) {
      const s = stakeFor(p.lambdaConst, fStar, cc, p.maxFraction, minBet)
      if (s === CANNOT_FUND) {
        ccRuin = i
      } else {
        cc += win ? s * p.b : -s
        if (cc > ccPeak) ccPeak = cc
        else if (ccPeak > 0) {
          const dd = (ccPeak - cc) / ccPeak
          if (dd > ccDD) ccDD = dd
        }
        if (cc <= ruinFloor) {
          cc = Math.max(cc, 0)
          ccRuin = i
        }
      }
    }

    if (caRuin < 0) {
      const lam = adaptiveLambda(ca, p.lambdaMin, p.lambdaMax, p.cRef, p.steepness)
      const s = stakeFor(lam, fStar, ca, p.maxFraction, minBet)
      if (s === CANNOT_FUND) {
        caRuin = i
      } else {
        ca += win ? s * p.b : -s
        if (ca > caPeak) caPeak = ca
        else if (caPeak > 0) {
          const dd = (caPeak - ca) / caPeak
          if (dd > caDD) caDD = dd
        }
        if (ca <= ruinFloor) {
          ca = Math.max(ca, 0)
          caRuin = i
        }
      }
    }

    if (opts.traceClassic) opts.traceClassic[i + 1] = cc
    if (opts.traceAdaptive) opts.traceAdaptive[i + 1] = ca

    if (cps && opts.cpClassic && opts.cpAdaptive && nextCp < cps.length && i + 1 === cps[nextCp]) {
      opts.cpClassic[base + nextCp] = cc
      opts.cpAdaptive[base + nextCp] = ca
      nextCp++
    }
  }

  return {
    classicFinal: cc,
    adaptiveFinal: ca,
    classicDD: ccDD,
    adaptiveDD: caDD,
    classicRuin: ccRuin,
    adaptiveRuin: caRuin,
  }
}

/** Bet indices at which the fan chart samples capital. Always includes 0 and N. */
export function makeCheckpoints(N: number, maxPoints = 100): number[] {
  const k = Math.min(N, maxPoints)
  const out = [0]
  for (let j = 1; j <= k; j++) out.push(Math.round((N * j) / k))
  // Guard against duplicates from rounding when N < maxPoints.
  return out.filter((v, i) => i === 0 || v > out[i - 1])
}

/** Re-runs a single path with full per-bet recording. Cheap enough for the main thread. */
export function simulateSinglePath(p: Params, pathIndex: number): PathTrace {
  const fStar = kellyFraction(p.p, p.b)
  const traceClassic = new Float64Array(p.N + 1)
  const traceAdaptive = new Float64Array(p.N + 1)
  const out = runPath(p, fStar, pathIndex, { traceClassic, traceAdaptive })
  return {
    index: pathIndex,
    classic: traceClassic,
    adaptive: traceAdaptive,
    classicRuinStep: out.classicRuin,
    adaptiveRuinStep: out.adaptiveRuin,
  }
}

function summarize(
  p: Params,
  terminals: Float64Array,
  drawdowns: Float64Array,
  ruinStep: Int32Array,
  cp: Float64Array,
  checkpoints: number[],
): StrategyResult {
  const n = terminals.length
  const sortedTerm = Float64Array.from(terminals).sort()

  // Ruined paths hit zero, so log(0) has to be floored to keep the mean finite.
  // 1e-9 x C0 is far below any meaningful bankroll but keeps the arithmetic sane.
  const logFloor = p.C0 * 1e-9
  const growths = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    growths[i] = Math.log(Math.max(terminals[i], logFloor) / p.C0) / p.N
  }
  const sortedGrowth = Float64Array.from(growths).sort()

  let ruined = 0
  let above = 0
  for (let i = 0; i < n; i++) {
    if (ruinStep[i] >= 0) ruined++
    if (terminals[i] > p.C0) above++
  }
  let worstDD = 0
  for (let i = 0; i < n; i++) if (drawdowns[i] > worstDD) worstDD = drawdowns[i]

  const stats: StrategyStats = {
    growthRate: mean(growths),
    medianGrowthRate: percentileSorted(sortedGrowth, 0.5),
    medianTerminal: percentileSorted(sortedTerm, 0.5),
    meanTerminal: mean(terminals),
    stdTerminal: stdDev(terminals),
    ruinProb: n ? ruined / n : 0,
    aboveStartProb: n ? above / n : 0,
    meanMaxDrawdown: mean(drawdowns),
    worstMaxDrawdown: worstDD,
    p10Terminal: percentileSorted(sortedTerm, 0.1),
    p90Terminal: percentileSorted(sortedTerm, 0.9),
  }

  // Percentile bands: one sort of the cross-path slice per checkpoint.
  const K = checkpoints.length
  const bands: Band[] = []
  const slice = new Float64Array(n)
  for (let c = 0; c < K; c++) {
    for (let i = 0; i < n; i++) slice[i] = cp[i * K + c]
    const s = slice.sort()
    bands.push({
      i: checkpoints[c],
      p10: percentileSorted(s, 0.1),
      p25: percentileSorted(s, 0.25),
      p50: percentileSorted(s, 0.5),
      p75: percentileSorted(s, 0.75),
      p90: percentileSorted(s, 0.9),
    })
  }

  return { stats, bands, terminals, drawdowns, ruinStep }
}

/**
 * Full Monte Carlo run. `onProgress` is called between path batches so a worker
 * can report back without the UI having to guess at completion.
 */
export function runSimulation(
  p: Params,
  onProgress?: (done: number, total: number) => void,
): SimResult {
  const t0 = Date.now()
  const fStar = kellyFraction(p.p, p.b)
  const checkpoints = makeCheckpoints(p.N)
  const K = checkpoints.length
  const n = p.paths

  const cpClassic = new Float64Array(n * K)
  const cpAdaptive = new Float64Array(n * K)
  const termClassic = new Float64Array(n)
  const termAdaptive = new Float64Array(n)
  const ddClassic = new Float64Array(n)
  const ddAdaptive = new Float64Array(n)
  const ruinClassic = new Int32Array(n)
  const ruinAdaptive = new Int32Array(n)

  // Batch so that ~200k bet-steps pass between progress reports.
  const batch = Math.max(1, Math.min(n, Math.floor(200_000 / Math.max(p.N, 1)) || 1))

  for (let start = 0; start < n; start += batch) {
    const end = Math.min(n, start + batch)
    for (let i = start; i < end; i++) {
      const out = runPath(p, fStar, i, {
        checkpoints,
        cpClassic,
        cpAdaptive,
        cpOffset: i,
      })
      termClassic[i] = out.classicFinal
      termAdaptive[i] = out.adaptiveFinal
      ddClassic[i] = out.classicDD
      ddAdaptive[i] = out.adaptiveDD
      ruinClassic[i] = out.classicRuin
      ruinAdaptive[i] = out.adaptiveRuin
    }
    onProgress?.(end, n)
  }

  return {
    params: p,
    fStar,
    checkpoints,
    classic: summarize(p, termClassic, ddClassic, ruinClassic, cpClassic, checkpoints),
    adaptive: summarize(p, termAdaptive, ddAdaptive, ruinAdaptive, cpAdaptive, checkpoints),
    elapsedMs: Date.now() - t0,
  }
}

/** Index of the path whose classic terminal capital is the median, plus the extremes. */
export function representativeIndices(terminals: Float64Array): {
  median: number
  best: number
  worst: number
} {
  const n = terminals.length
  if (n === 0) return { median: 0, best: 0, worst: 0 }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => terminals[a] - terminals[b])
  return {
    median: order[Math.floor((n - 1) / 2)],
    best: order[n - 1],
    worst: order[0],
  }
}
