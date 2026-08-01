import { fmtCapital, fmtGrowth, fmtPct } from '../lib/format'
import type { SimResult, StrategyStats } from '../lib/types'
import type { ChartTheme } from '../lib/chartTheme'
import { ChartCard } from './ui'

interface Row {
  name: string
  hint: string
  value: (s: StrategyStats) => string
  raw: (s: StrategyStats) => number
  /** Which direction counts as better, for the bolding. */
  better: 'high' | 'low' | 'none'
}

const ROWS: Row[] = [
  {
    name: 'Geometric growth rate / bet',
    hint: 'mean over paths of log(C_T / C₀) ÷ N — the quantity Kelly actually maximises',
    value: (s) => fmtGrowth(s.growthRate),
    raw: (s) => s.growthRate,
    better: 'high',
  },
  {
    name: 'Median growth rate / bet',
    hint: 'same quantity at the median path — robust to the fat right tail',
    value: (s) => fmtGrowth(s.medianGrowthRate),
    raw: (s) => s.medianGrowthRate,
    better: 'high',
  },
  {
    name: 'Probability of ruin',
    hint: 'paths that hit the ruin floor or could not fund the minimum bet',
    value: (s) => fmtPct(s.ruinProb, 2),
    raw: (s) => s.ruinProb,
    better: 'low',
  },
  {
    name: 'Median terminal capital',
    hint: 'the typical outcome — half the paths finish above this',
    value: (s) => fmtCapital(s.medianTerminal),
    raw: (s) => s.medianTerminal,
    better: 'high',
  },
  {
    name: 'Mean terminal capital',
    hint: 'dominated by a few runaway paths; always read it next to the median',
    value: (s) => fmtCapital(s.meanTerminal),
    raw: (s) => s.meanTerminal,
    better: 'none',
  },
  {
    name: 'Std dev of terminal capital',
    hint: 'spread of final outcomes across paths',
    value: (s) => fmtCapital(s.stdTerminal),
    raw: (s) => s.stdTerminal,
    better: 'none',
  },
  {
    name: '10th percentile terminal',
    hint: 'the bad-but-not-worst case',
    value: (s) => fmtCapital(s.p10Terminal),
    raw: (s) => s.p10Terminal,
    better: 'high',
  },
  {
    name: '90th percentile terminal',
    hint: 'the good case',
    value: (s) => fmtCapital(s.p90Terminal),
    raw: (s) => s.p90Terminal,
    better: 'high',
  },
  {
    name: 'Paths finishing above C₀',
    hint: 'share of runs that made money at all',
    value: (s) => fmtPct(s.aboveStartProb, 1),
    raw: (s) => s.aboveStartProb,
    better: 'high',
  },
  {
    name: 'Max drawdown — average',
    hint: 'mean across paths of the deepest peak-to-trough fall',
    value: (s) => fmtPct(s.meanMaxDrawdown, 1),
    raw: (s) => s.meanMaxDrawdown,
    better: 'low',
  },
  {
    name: 'Max drawdown — worst path',
    hint: 'the deepest fall seen anywhere in the run',
    value: (s) => fmtPct(s.worstMaxDrawdown, 1),
    raw: (s) => s.worstMaxDrawdown,
    better: 'low',
  },
]

export function StatsTable({ result, theme }: { result: SimResult; theme: ChartTheme }) {
  const c = result.classic.stats
  const a = result.adaptive.stats

  const isBetter = (row: Row, side: 'c' | 'a') => {
    if (row.better === 'none') return false
    const cv = row.raw(c)
    const av = row.raw(a)
    if (!isFinite(cv) || !isFinite(av) || cv === av) return false
    const winner = row.better === 'high' ? (cv > av ? 'c' : 'a') : cv < av ? 'c' : 'a'
    return winner === side
  }

  return (
    <ChartCard
      title="Summary statistics across every path"
      description="Bold marks the better of the two on metrics that have a clear direction. Mean terminal capital and standard deviation are left unmarked — bigger is not automatically better for either."
    >
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>
                <span className="head-swatch" style={{ background: theme.classic }} />
                Classic
              </th>
              <th>
                <span className="head-swatch" style={{ background: theme.adaptive }} />
                Adaptive
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.name}>
                <td>
                  <div>{row.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>{row.hint}</div>
                </td>
                <td className={isBetter(row, 'c') ? 'better' : undefined}>{row.value(c)}</td>
                <td className={isBetter(row, 'a') ? 'better' : undefined}>{row.value(a)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        Ruined paths end at zero capital, so the growth-rate average floors their terminal capital
        at 10⁻⁹ × C₀ to keep the logarithm finite. A strategy that ruins often will show a strongly
        negative growth rate — that is the intended penalty, not an artefact.
      </p>
    </ChartCard>
  )
}
