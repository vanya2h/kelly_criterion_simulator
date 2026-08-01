/** All user-tunable simulation inputs. One flat object so it can be structured-cloned to the worker. */
export interface Params {
  /** Starting capital. */
  C0: number;
  /** Win probability per bet. */
  p: number;
  /** Payout odds: a win pays b x stake, a loss forfeits the stake. */
  b: number;
  /** Bets per path. */
  N: number;
  /** Independent Monte Carlo paths. */
  paths: number;

  /** Classic strategy: constant multiplier on the Kelly fraction. */
  lambdaConst: number;

  /** Adaptive strategy: fraction approached as capital grows large. */
  lambdaMin: number;
  /** Adaptive strategy: fraction approached as capital goes to zero. */
  lambdaMax: number;
  /** Adaptive strategy: capital at which lambda sits at the midpoint. */
  cRef: number;
  /** Adaptive strategy: sigmoid steepness. */
  steepness: number;

  /** Model a minimum ticket size (betting discreteness). */
  minBetEnabled: boolean;
  minBet: number;

  /** Capital level at or below which a path is declared ruined and stops. */
  ruinFloorEnabled: boolean;
  ruinFloor: number;

  /** Hard cap on any single stake, as a fraction of current capital. */
  maxFraction: number;

  /**
   * RNG seed in force. Always the seed the run actually used — "Run simulation"
   * rerolls it, and typing one in reproduces that run exactly.
   */
  seed: number;
}

export type StrategyKey = "classic" | "adaptive";

/** Aggregate statistics for one strategy across all paths. */
export interface StrategyStats {
  /** Per-bet geometric growth rate: mean over paths of log(C_T / C_0) / N. */
  growthRate: number;
  /** Median of the per-path growth rate — robust to the fat right tail. */
  medianGrowthRate: number;
  medianTerminal: number;
  meanTerminal: number;
  stdTerminal: number;
  /** Fraction of paths that hit the ruin floor or could not fund the minimum bet. */
  ruinProb: number;
  /** Fraction of paths finishing above starting capital. */
  aboveStartProb: number;
  meanMaxDrawdown: number;
  worstMaxDrawdown: number;
  p10Terminal: number;
  p90Terminal: number;
}

/** Percentile band of capital across paths at one checkpoint. */
export interface Band {
  /** Bet index this checkpoint was sampled at. */
  i: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface StrategyResult {
  stats: StrategyStats;
  bands: Band[];
  /** Terminal capital of every path, unsorted (path order). */
  terminals: Float64Array;
  /** Per-path max drawdown as a fraction of the running peak. */
  drawdowns: Float64Array;
  /** Bet index at which each path was ruined, or -1 if it survived. */
  ruinStep: Int32Array;
}

export interface SimResult {
  params: Params;
  /** The Kelly-optimal fraction f* for these odds. */
  fStar: number;
  /** Bet indices the bands were sampled at (always starts at 0, ends at N). */
  checkpoints: number[];
  classic: StrategyResult;
  adaptive: StrategyResult;
  /** Wall-clock milliseconds spent in the worker. */
  elapsedMs: number;
}

/** One fully-recorded path, both strategies over identical random draws. */
export interface PathTrace {
  index: number;
  classic: Float64Array;
  adaptive: Float64Array;
  classicRuinStep: number;
  adaptiveRuinStep: number;
}
