# Kelly Criterion Simulator — classic vs. capital-adaptive fraction

An interactive Monte Carlo sandbox for one question: if you are going to bet a
multiple λ of the Kelly-optimal fraction, does it help to make λ depend on how
much money you currently have?

Two strategies play the **same repeated wager against the same random draws**:

| | stake |
|---|---|
| **Classic** | `λ_const · f* · C` |
| **Adaptive** | `λ(C) · f* · C`, with `λ(C) = λ_min + (λ_max − λ_min) / (1 + (C / C_ref)^steepness)` |

where `f* = p − q/b` is the Kelly fraction, `p` the win probability, `q = 1 − p`,
and `b` the payout odds (a win pays `b × stake`, a loss forfeits the stake).
`λ(C) → λ_max` as capital goes to zero and `→ λ_min` as it grows, so adaptive
bets harder when small and calmer when large.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # → dist/kelly_simulator.html
```

The build inlines all JS, CSS and the simulation Web Worker into **one HTML
file** with no external requests, so `dist/kelly_simulator.html` opens straight
from disk with no server (`vite-plugin-singlefile` does the inlining). If a
browser refuses to start the inlined worker on a `file://` page, the app falls
back to running the simulation on the main thread.

## What's in it

- **λ(C) curve** — the sizing rule itself, live as you drag the sliders, with a
  reference line for `λ_const` and a second view showing the actual share of
  capital staked (`λ · f*`) against the safety cap.
- **Single path** — one run, both strategies, identical coin flips. Every gap
  between the curves is the sizing rule and nothing else. Pick the median, best,
  worst, or any path index; log or linear axis.
- **Monte Carlo fan** — median plus 25–75 and 10–90 percentile bands, side by
  side on a shared capital axis, each panel also carrying the other strategy's
  median for comparison.
- **Terminal capital histogram** — both strategies on shared bin edges, log or
  linear bins, with a dedicated bucket for ruined paths.
- **Summary statistics** — per-bet geometric growth rate, probability of ruin,
  median / mean / spread of terminal capital, percentiles, and max drawdown
  (average and worst path).

Every chart has a **Table** toggle showing the same numbers as text.

## The part that actually matters

With continuous stakes and no floor, fractional Kelly **cannot go broke** — the
bet shrinks with the bankroll forever, so the ruin probability is 0% no matter
how reckless λ is. The strategies only diverge once betting is discrete:

- **`min_bet`** — the smallest ticket the table accepts. A rule that wants to bet
  less has to bet this much anyway, so below a certain bankroll you are forced to
  overbet; below the ticket itself you cannot bet at all and you are out.
- **`ruin_floor`** — capital at or below this level ends the path.

Turn `min_bet` off and the ruin columns go to zero and stay there. The app says
so in a callout rather than letting you read a meaningless 0%.

## Controls

The panel shows only the controls that answer the question the app exists for.
Everything with a defensible default sits behind **Advanced settings**.

Always visible:

| Parameter | Meaning | Range |
|---|---|---|
| `p` | win probability | 0.01 – 0.99 |
| `b` | payout odds | 0.1 – 10 |
| `N` | bets per path | 10 – 5,000 |
| `paths` | Monte Carlo runs | 1 – 5,000 |
| `λ_const` | classic Kelly multiplier | 0 – 1 |
| `λ_min` | adaptive multiplier when rich | 0 – 1 |
| `λ_max` | adaptive multiplier when broke | 0 – 1 |

Under **Advanced settings**:

| Parameter | Meaning | Range |
|---|---|---|
| `C_ref` | capital where λ sits at the midpoint | 1 – 1,000,000 |
| `steepness` | sigmoid sharpness | 0.5 – 10 |
| `C0` | starting capital | 100 – 1,000,000 |
| `max_fraction_of_capital` | hard cap on any single stake | 0.01 – 1 |
| `min_bet` | minimum ticket size (toggle) | 0 – 100 |
| `ruin_floor` | capital counted as ruined (toggle) | 0 – C₀ |
| `seed` | RNG seed; rerolled by *Run simulation*, editable to replay a run | — |
| auto-run | rerun automatically after a change | on |

Auto-run reruns 300 ms after the last change while the job stays under 400,000
bet-steps; larger jobs wait for the button so a slider drag cannot stall the
machine.

## Notes on the implementation

- **Shared randomness.** Each path seeds its own stream; one draw per bet feeds
  both strategies. Differences between the curves are never luck.
- **Reproducibility.** **Run simulation** rerolls the seed, so every click is a
  fresh set of dice. Changing a parameter keeps the seed, so the charts move
  because the strategy changed and not because the dice did. The rerolled seed is
  written straight back into the controls — type one in to reproduce that run
  exactly, down to the individual path.
- **Off the main thread.** The Monte Carlo runs in a Web Worker with batched
  progress reporting; starting a new run terminates the in-flight one. 5,000
  paths × 5,000 bets (25M bet-steps per strategy) takes well under a second and
  the UI stays interactive throughout.
- **Bounded memory.** Full trajectories are never stored for every path — the fan
  chart samples ~100 checkpoints, and the single-path view re-simulates one path
  on demand.
- **Growth rate with ruin.** Ruined paths end at zero, so the mean-log growth
  rate floors their terminal capital at `1e-9 × C₀` to keep the logarithm finite.
  A strategy that ruins often shows a strongly negative growth rate; that is the
  intended penalty, and the median growth rate is reported next to it.

## Stack

React 19 + TypeScript + Vite, Recharts for the charts, no other runtime
dependencies. Chart colours are a CVD-validated blue/orange pair, stepped
separately for light and dark surfaces.
