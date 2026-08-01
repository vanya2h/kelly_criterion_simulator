import type { Params } from "./types";

export const DEFAULT_PARAMS: Params = {
  C0: 1000,
  p: 0.55,
  b: 1,
  N: 250,
  paths: 1000,

  lambdaConst: 0.5,

  lambdaMin: 0.25,
  lambdaMax: 1,
  cRef: 1000,
  steepness: 2,

  minBetEnabled: true,
  minBet: 5,

  ruinFloorEnabled: true,
  ruinFloor: 10,

  maxFraction: 0.5,

  seed: 20260801,
};

/** Above this many bet-steps, auto-run is suppressed and the button takes over. */
export const AUTORUN_STEP_BUDGET = 400_000;

export function stepCount(p: Params): number {
  return p.paths * p.N;
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
