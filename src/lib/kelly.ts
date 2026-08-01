import type { Params } from './types'

/**
 * Kelly-optimal fraction of capital for a discrete edge bet.
 *
 *   f* = p - q/b     with q = 1 - p
 *
 * Negative f* means the bet has no edge and the optimal action is not to bet.
 */
export function kellyFraction(p: number, b: number): number {
  if (!(b > 0)) return 0
  return p - (1 - p) / b
}

/**
 * Adaptive fraction: a sigmoid ramp in capital.
 *
 *   lambda(C) = lambda_min + (lambda_max - lambda_min) / (1 + (C / C_ref)^steepness)
 *
 * C -> 0   gives lambda_max (aggressive when small)
 * C -> inf gives lambda_min (conservative when large)
 * C = C_ref gives the midpoint of the two.
 */
export function adaptiveLambda(
  C: number,
  lambdaMin: number,
  lambdaMax: number,
  cRef: number,
  steepness: number,
): number {
  if (!(cRef > 0)) return lambdaMin
  const x = Math.max(C, 0) / cRef
  const denom = 1 + Math.pow(x, steepness)
  return lambdaMin + (lambdaMax - lambdaMin) / denom
}

/** Sentinel returned by {@link stakeFor} when a minimum ticket cannot be funded. */
export const CANNOT_FUND = -1

/**
 * Stake for one bet, after every clamp:
 *  1. lambda * f* * C, floored at 0 (no edge / no bet means no stake)
 *  2. capped by max_fraction_of_capital
 *  3. raised to the minimum ticket size if a smaller bet was wanted
 *  4. capped by the capital actually on hand
 *
 * Step 3 is the interesting one: below a certain capital the minimum ticket is
 * *larger* than the Kelly stake, so playing at all means overbetting. If it is
 * larger than the whole bankroll the path cannot bet and is stuck — that is the
 * {@link CANNOT_FUND} case, counted as ruin.
 */
export function stakeFor(
  lambda: number,
  fStar: number,
  C: number,
  maxFraction: number,
  minBet: number,
): number {
  let s = lambda * fStar * C
  if (!(s > 0)) return 0
  const cap = maxFraction * C
  if (s > cap) s = cap
  if (minBet > 0 && s < minBet) {
    if (minBet > C) return CANNOT_FUND
    s = minBet
  }
  return s > C ? C : s
}

/** Sample points of the lambda(C) curve, for plotting. */
export function lambdaCurve(
  params: Params,
  maxCapital: number,
  samples = 160,
): { C: number; adaptive: number; classic: number }[] {
  const out: { C: number; adaptive: number; classic: number }[] = []
  for (let i = 0; i <= samples; i++) {
    const C = (maxCapital * i) / samples
    out.push({
      C,
      adaptive: adaptiveLambda(C, params.lambdaMin, params.lambdaMax, params.cRef, params.steepness),
      classic: params.lambdaConst,
    })
  }
  return out
}
